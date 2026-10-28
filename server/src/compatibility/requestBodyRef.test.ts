
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkRequestBodyCompatibility } from "./requestBodyChecker.js";
import { extractOperations } from "../parser/operationExtractor.js";
import path from "node:path";

describe("request body $ref compatibility", () => {
  it("detects a newly required property in a referenced schema", async () => {
    const oldSpec = await extractOperations(
      path.resolve("Specs", "request-body-ref-v1.yaml")
    );

    const newSpec = await extractOperations(
      path.resolve("Specs", "request-body-ref-v2.yaml")
    );

    const issues = checkRequestBodyCompatibility(oldSpec, newSpec);

    assert.ok(
      issues.some(
        (issue) =>
          issue.operation === "POST /products" &&
          issue.message.toLowerCase().includes("price")
      ),
      "Expected a breaking change involving price in POST /products"
    );
  });
});
