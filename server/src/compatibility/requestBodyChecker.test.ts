
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  checkRequestBodyCompatibility,
} from "./requestBodyChecker.js";

import type {
  OperationMap,
} from "../parser/operationExtractor.js";

function createOperations(
  schema: Record<string, unknown>
): OperationMap {
  return new Map([
    [
      "POST /products",
      {
        requestBody: {
          required: true,
          content: {
            "application/json": { schema },
          },
        },
      },
    ],
  ]);
}

describe("Request body compatibility checker", () => {
  it("detects a newly required request field", () => {
    const oldOperations: OperationMap = new Map([
      [
        "POST /products",
        {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                  },
                  required: ["name"],
                },
              },
            },
          },
        },
      ],
    ]);

    const newOperations: OperationMap = new Map([
      [
        "POST /products",
        {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    category: { type: "string" },
                  },
                  required: ["name", "category"],
                },
              },
            },
          },
        },
      ],
    ]);

    const issues = checkRequestBodyCompatibility(
      oldOperations,
      newOperations
    );

    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /category/);
  });

  it("detects a request field type change", () => {
    const oldOperations = createOperations({
      type: "object",
      properties: {
        price: { type: "number" },
      },
    });

    const newOperations = createOperations({
      type: "object",
      properties: {
        price: { type: "string" },
      },
    });

    const issues = checkRequestBodyCompatibility(
      oldOperations,
      newOperations
    );

    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /number.*string/);
  });

  it("does not report an unchanged request body", () => {
    const operations = createOperations({
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    });

    const issues = checkRequestBodyCompatibility(
      operations,
      operations
    );

    assert.equal(issues.length, 0);
  });

  it("detects a newly required nested request field", () => {
    const oldOperations = createOperations({
      type: "object",
      properties: {
        category: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
        },
      },
    });

    const newOperations = createOperations({
      type: "object",
      properties: {
        category: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
          },
        },
      },
    });

    const issues = checkRequestBodyCompatibility(
      oldOperations,
      newOperations
    );

    assert.ok(
      issues.some((issue) => issue.message.includes("category.name")),
      "Expected nested category.name to be reported as newly required"
    );
  });

  it("detects removal of an allowed request enum value", () => {
    const oldOperations = createOperations({
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pending", "active"],
        },
      },
    });

    const newOperations = createOperations({
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pending"],
        },
      },
    });

    const issues = checkRequestBodyCompatibility(
      oldOperations,
      newOperations
    );

    assert.ok(
      issues.some((issue) =>
        issue.message.includes("active")
      ),
      "Expected removal of 'active' to be reported"
    );
  });

  it("detects a newly introduced enum restriction", () => {
    const oldOperations = createOperations({
      type: "object",
      properties: {
        status: { type: "string" },
      },
    });

    const newOperations = createOperations({
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pending", "active"],
        },
      },
    });

    const issues = checkRequestBodyCompatibility(
      oldOperations,
      newOperations
    );

    assert.ok(
      issues.some((issue) => issue.message.includes("enum")),
      "Expected a newly introduced enum restriction to be reported"
    );
  });

  it("does not flag an expanded request enum", () => {
    const oldOperations = createOperations({
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pending"],
        },
      },
    });

    const newOperations = createOperations({
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pending", "active"],
        },
      },
    });

    const issues = checkRequestBodyCompatibility(
      oldOperations,
      newOperations
    );

    assert.equal(issues.length, 0);
  });

  it("detects a request field format change", () => {
    const oldOperations = createOperations({
      type: "object",
      properties: {
        createdAt: {
          type: "string",
          format: "date-time",
        },
      },
    });

    const newOperations = createOperations({
      type: "object",
      properties: {
        createdAt: {
          type: "string",
          format: "date",
        },
      },
    });

    const issues = checkRequestBodyCompatibility(
      oldOperations,
      newOperations
    );

    assert.ok(
      issues.some(
        (issue) =>
          issue.message.includes("date-time") &&
          issue.message.includes("date")
      ),
      "Expected the format change to be reported"
    );
  });

  it("detects enum restrictions in nested request fields", () => {
    const oldOperations = createOperations({
      type: "object",
      properties: {
        category: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["pending", "active"],
            },
          },
        },
      },
    });

    const newOperations = createOperations({
      type: "object",
      properties: {
        category: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["pending"],
            },
          },
        },
      },
    });

    const issues = checkRequestBodyCompatibility(
      oldOperations,
      newOperations
    );

    assert.ok(
      issues.some(
        (issue) =>
          issue.message.includes("category.status") &&
          issue.message.includes("active")
      ),
      "Expected the nested enum restriction to be reported"
    );
  });

  
  it("detects removal of a supported request content type", () => {
    const oldOperations: OperationMap = new Map([
      [
        "POST /products",
        {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" },
              },
              "application/xml": {
                schema: { type: "object" },
              },
            },
          },
        },
      ],
    ]);

    const newOperations: OperationMap = new Map([
      [
        "POST /products",
        {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
        },
      ],
    ]);

    const issues = checkRequestBodyCompatibility(
      oldOperations,
      newOperations
    );

    assert.ok(
      issues.some((issue) => issue.message.includes("application/xml")),
      "Expected removal of application/xml to be reported"
    );
  });

  it("does not flag an added request content type as breaking", () => {
    const oldOperations: OperationMap = new Map([
      [
        "POST /products",
        {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
        },
      ],
    ]);

    const newOperations: OperationMap = new Map([
      [
        "POST /products",
        {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" },
              },
              "application/xml": {
                schema: { type: "object" },
              },
            },
          },
        },
      ],
    ]);

    const issues = checkRequestBodyCompatibility(
      oldOperations,
      newOperations
    );

    assert.equal(issues.length, 0);
  });

  it("detects removal of a previously required request body", () => {
    const oldOperations: OperationMap = new Map([
      [
        "POST /products",
        {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
        },
      ],
    ]);

    const newOperations: OperationMap = new Map([
      [
        "POST /products",
        {},
      ],
    ]);

    const issues = checkRequestBodyCompatibility(
      oldOperations,
      newOperations
    );

    assert.ok(
      issues.some((issue) => issue.message.toLowerCase().includes("request body")),
      "Expected removal of the required request body to be reported"
    );
  });

  it("detects removal of a request schema", () => {
    const oldOperations: OperationMap = new Map([
      [
        "POST /products",
        {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
        },
      ],
    ]);

    const newOperations: OperationMap = new Map([
      [
        "POST /products",
        {
          requestBody: {
            required: true,
            content: {
              "application/json": {},
            },
          },
        },
      ],
    ]);

    const issues = checkRequestBodyCompatibility(
      oldOperations,
      newOperations
    );

    assert.ok(
      issues.some((issue) => issue.message.includes("schema")),
      "Expected removal of the request schema to be reported"
    );
  });


});
