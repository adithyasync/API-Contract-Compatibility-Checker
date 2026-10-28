
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { checkRequestCompatibility } from "./requestChecker.js";
import type { OperationMap } from "../parser/operationExtractor.js";

function createOperations(
  parameters: Array<{
    name: string;
    in: "query" | "path" | "header" | "cookie";
    required?: boolean;
    schema?: {
      type?: string;
      format?: string;
      enum?: unknown[];
    };
  }>
): OperationMap {
  return new Map([
    [
      "GET /products",
      { parameters },
    ],
  ]);
}

describe("Request compatibility checker", () => {
  it("detects a newly required parameter", () => {
    const oldOperations = createOperations([]);

    const newOperations = createOperations([
      {
        name: "region",
        in: "query",
        required: true,
        schema: { type: "string" },
      },
    ]);

    const issues = checkRequestCompatibility(oldOperations, newOperations);

    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /region/);
  });

  it("detects an optional parameter becoming required", () => {
    const oldOperations = createOperations([
      {
        name: "category",
        in: "query",
        required: false,
        schema: { type: "string" },
      },
    ]);

    const newOperations = createOperations([
      {
        name: "category",
        in: "query",
        required: true,
        schema: { type: "string" },
      },
    ]);

    const issues = checkRequestCompatibility(oldOperations, newOperations);

    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /optional to required/);
  });

  it("does not report an unchanged optional parameter", () => {
    const operations = createOperations([
      {
        name: "category",
        in: "query",
        required: false,
        schema: { type: "string" },
      },
    ]);

    const issues = checkRequestCompatibility(operations, operations);

    assert.equal(issues.length, 0);
  });

  it("detects a parameter type change", () => {
    const oldOperations = createOperations([
      {
        name: "limit",
        in: "query",
        schema: { type: "integer" },
      },
    ]);

    const newOperations = createOperations([
      {
        name: "limit",
        in: "query",
        schema: { type: "string" },
      },
    ]);

    const issues = checkRequestCompatibility(oldOperations, newOperations);

    assert.ok(
      issues.some(
        (issue) =>
          issue.message.includes("integer") &&
          issue.message.includes("string")
      )
    );
  });

  it("detects removal of an allowed parameter enum value", () => {
    const oldOperations = createOperations([
      {
        name: "status",
        in: "query",
        schema: {
          type: "string",
          enum: ["pending", "active"],
        },
      },
    ]);

    const newOperations = createOperations([
      {
        name: "status",
        in: "query",
        schema: {
          type: "string",
          enum: ["pending"],
        },
      },
    ]);

    const issues = checkRequestCompatibility(oldOperations, newOperations);

    assert.ok(
      issues.some((issue) => issue.message.includes("active"))
    );
  });

  it("does not flag an expanded parameter enum", () => {
    const oldOperations = createOperations([
      {
        name: "status",
        in: "query",
        schema: {
          type: "string",
          enum: ["pending"],
        },
      },
    ]);

    const newOperations = createOperations([
      {
        name: "status",
        in: "query",
        schema: {
          type: "string",
          enum: ["pending", "active"],
        },
      },
    ]);

    const issues = checkRequestCompatibility(oldOperations, newOperations);

    assert.equal(issues.length, 0);
  });

  it("detects a parameter format change", () => {
    const oldOperations = createOperations([
      {
        name: "createdAt",
        in: "query",
        schema: {
          type: "string",
          format: "date-time",
        },
      },
    ]);

    const newOperations = createOperations([
      {
        name: "createdAt",
        in: "query",
        schema: {
          type: "string",
          format: "date",
        },
      },
    ]);

    const issues = checkRequestCompatibility(oldOperations, newOperations);

    assert.ok(
      issues.some(
        (issue) =>
          issue.message.includes("date-time") &&
          issue.message.includes("date")
      )
    );
  });

  it("detects removal of an existing parameter", () => {
    const oldOperations = createOperations([
      {
        name: "region",
        in: "query",
        schema: { type: "string" },
      },
    ]);

    const newOperations = createOperations([]);

    const issues = checkRequestCompatibility(oldOperations, newOperations);

    assert.ok(
      issues.some((issue) => issue.message.includes("region"))
    );
  });
});
