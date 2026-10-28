
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractOperations } from "./operationExtractor.js";
import path from "node:path";

describe("extractOperations", () => {
  it("includes path-level parameters in operations", async () => {
    const specPath = path.resolve(
      "Specs",
      "parameter-inheritance-test.yaml"
    );

    const operations = await extractOperations(specPath);
    const operation = operations.get("GET /products/{productId}");

    assert.ok(operation, "Expected GET product operation to exist");

    assert.ok(
      operation.parameters?.some(
        (parameter) =>
          parameter.name === "productId" &&
          parameter.in === "path" &&
          parameter.required === true
      ),
      "Expected the required path-level productId parameter to be inherited"
    );
  });

  
it("resolves reusable parameters referenced with $ref", async () => {
  const specPath = path.resolve(
    "Specs",
    "parameter-ref-test.yaml"
  );

  const operations = await extractOperations(specPath);
  const operation = operations.get("GET /products/{productId}");

  assert.ok(operation, "Expected GET product operation to exist");

  assert.ok(
    operation.parameters?.some(
      (parameter) =>
        parameter.name === "productId" &&
        parameter.in === "path" &&
        parameter.required === true &&
        parameter.schema?.type === "string"
    ),
    "Expected referenced ProductId parameter to be resolved"
  );
});

});
