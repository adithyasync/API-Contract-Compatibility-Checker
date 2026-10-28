
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkResponseCompatibility } from "./responseChecker.js";
import { extractOperations } from "../parser/operationExtractor.js";
import path from "node:path";

describe("response $ref compatibility", () => {
  it("detects a response property type change in a referenced schema", async () => {
    const oldSpec = await extractOperations(
      path.resolve("Specs", "response-ref-v1.yaml")
    );

    const newSpec = await extractOperations(
      path.resolve("Specs", "response-ref-v2.yaml")
    );

    const issues = checkResponseCompatibility(oldSpec, newSpec);

    assert.ok(
      issues.some(
        (issue) =>
          issue.operation === "GET /products/{productId}" &&
          issue.message.toLowerCase().includes("name")
      ),
      "Expected a breaking change involving the name response property"
    );
  });
});
