
import express from "express";
import cors from "cors";
import multer from "multer";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { compareSpecifications } from "./compatibility/compatibilityChecker.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB per uploaded file
const MAX_TEXT_SIZE = 1 * 1024 * 1024; // 1 MB per pasted specification

// Store uploads and pasted specifications temporarily.
// Temporary files are removed after comparison.
const uploadDirectory = path.join(os.tmpdir(), "api-contract-guardian");

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    fs.mkdir(uploadDirectory, { recursive: true })
      .then(() => callback(null, uploadDirectory))
      .catch((error: Error) => callback(error, uploadDirectory));
  },
  filename: (_req, file, callback) => {
    callback(
      null,
      `${Date.now()}-${Math.random().toString(36).slice(2)}-${path.basename(file.originalname)}`
    );
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 2,
    fields: 10,
    fieldSize: MAX_TEXT_SIZE,
  },
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "API Contract Guardian",
  });
});

app.post(
  "/api/compatibility/check",
  upload.fields([
    { name: "oldSpec", maxCount: 1 },
    { name: "newSpec", maxCount: 1 },
  ]),
  async (req, res) => {
    const files = req.files as
      | Record<string, Express.Multer.File[]>
      | undefined;

    const oldFile = files?.oldSpec?.[0];
    const newFile = files?.newSpec?.[0];

    // Track every temporary file so it can be cleaned up.
    const temporaryPaths = new Set<string>();

    if (oldFile) temporaryPaths.add(oldFile.path);
    if (newFile) temporaryPaths.add(newFile.path);

    try {
      const oldSpecText = req.body?.oldSpecText;
      const newSpecText = req.body?.newSpecText;

      const hasAnyFile = Boolean(oldFile || newFile);
      const hasAnyText =
        oldSpecText !== undefined || newSpecText !== undefined;

      // Do not allow a mixture of uploaded files and pasted text.
      if (hasAnyFile && hasAnyText) {
        res.status(400).json({
          error:
            "Choose either file uploads or pasted specifications, not both.",
        });
        return;
      }

      let oldSpecPath: string;
      let newSpecPath: string;

      if (hasAnyFile) {
        if (!oldFile || !newFile) {
          res.status(400).json({
            error: "Upload both oldSpec and newSpec files.",
          });
          return;
        }

        oldSpecPath = oldFile.path;
        newSpecPath = newFile.path;
      } else {
        // Pasted specifications arrive as multipart text fields.
        if (
          typeof oldSpecText !== "string" ||
          typeof newSpecText !== "string" ||
          !oldSpecText.trim() ||
          !newSpecText.trim()
        ) {
          res.status(400).json({
            error:
              "Provide both old and new specifications using file uploads or pasted text.",
          });
          return;
        }

        const oldSize = Buffer.byteLength(oldSpecText, "utf8");
        const newSize = Buffer.byteLength(newSpecText, "utf8");

        if (oldSize > MAX_TEXT_SIZE || newSize > MAX_TEXT_SIZE) {
          res.status(413).json({
            error: "Each pasted specification must be 1 MB or smaller.",
          });
          return;
        }

        await fs.mkdir(uploadDirectory, { recursive: true });

        const createTemporarySpec = async (
          content: string,
          label: string
        ): Promise<string> => {
          // JSON is also valid YAML, but using the matching extension
          // makes the temporary files easier to identify and debug.
          const trimmed = content.trimStart();
          const extension =
            trimmed.startsWith("{") || trimmed.startsWith("[")
              ? ".json"
              : ".yaml";

          const filePath = path.join(
            uploadDirectory,
            `${Date.now()}-${Math.random().toString(36).slice(2)}-${label}${extension}`
          );

          // Track the path before writing so cleanup can handle failures.
          temporaryPaths.add(filePath);
          await fs.writeFile(filePath, content, "utf8");

          return filePath;
        };

        oldSpecPath = await createTemporarySpec(oldSpecText, "old-spec");
        newSpecPath = await createTemporarySpec(newSpecText, "new-spec");
      }

      // Both input modes use the same compatibility engine.
      const report = await compareSpecifications(
        oldSpecPath,
        newSpecPath
      );

      res.json(report);
    } catch (error: unknown) {
      res.status(400).json({
        error: "Unable to compare the specifications.",
        details:
          error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      await Promise.all(
        [...temporaryPaths].map((filePath) =>
          fs.unlink(filePath).catch(() => undefined)
        )
      );
    }
  }
);

// Handle upload errors, including oversized files and text fields.
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          error: "Each uploaded specification must be 2 MB or smaller.",
        });
        return;
      }

      if (error.code === "LIMIT_FIELD_VALUE") {
        res.status(413).json({
          error: "Each pasted specification must be 1 MB or smaller.",
        });
        return;
      }

      res.status(400).json({
        error: error.message,
      });
      return;
    }

    res.status(500).json({
      error: "An unexpected server error occurred.",
    });
  }
);

app.listen(PORT, () => {
  console.log(
    `API Contract Guardian API running at http://localhost:${PORT}`
  );
});

export default app;
