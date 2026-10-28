import SwaggerParser from "@apidevtools/swagger-parser";
import path from "node:path";

const projectRoot = process.cwd();

async function validateOpenAPI(): Promise<void> {
  const filePath = path.join(
    projectRoot,
    "Specs",
    "Product-api-v1.yaml"
  );

  try {
    const api = await SwaggerParser.validate(filePath);

    console.log("OpenAPI specification is valid!");
    console.log("API title:", api.info.title);
    console.log("API version:", api.info.version);
  } catch (error) {
    console.error("OpenAPI validation failed:", error);
  }
}

validateOpenAPI();