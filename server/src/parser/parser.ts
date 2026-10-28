
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

function parseFile(filePath: string): unknown {
  const content = fs.readFileSync(filePath, "utf-8");

  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".json") {
    return JSON.parse(content);
  }

  if (extension === ".yaml" || extension === ".yml") {
    return YAML.parse(content);
  }

  throw new Error(`Unsupported file type: ${extension}`);
}

try {
  const filePath = "Specs/Product-api-v1.yaml";

  const data = parseFile(filePath);

  console.log("File parsed successfully!");
  console.log(data);
} catch (error) {
  console.error("Parsing failed:", error);
}
