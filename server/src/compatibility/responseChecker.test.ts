
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { checkResponseCompatibility } from "./responseChecker.js";
import type { OperationMap } from "../parser/operationExtractor.js";

function createOperations(schema: Record<string, unknown>): OperationMap {
  return new Map([
    [
      "GET /products/{id}",
      {
        responses: {
          "200": {
            content: {
              "application/json": { schema },
            },
          },
        },
      },
    ],
  ]);
}

describe("Response compatibility checker", () => {
  it("detects a removed response status code", () => {
    const oldOperations: OperationMap = new Map([
      [
        "GET /products/{id}",
        {
          responses: {
            "200": { description: "Product found" },
            "404": { description: "Product not found" },
          },
        },
      ],
    ]);

    const newOperations: OperationMap = new Map([
      [
        "GET /products/{id}",
        {
          responses: {
            "200": { description: "Product found" },
          },
        },
      ],
    ]);

    const issues = checkResponseCompatibility(oldOperations, newOperations);

    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /404/);
  });

  it("detects a response property type change", () => {
    const oldOperations = createOperations({
      type: "object",
      properties: { price: { type: "number" } },
    });

    const newOperations = createOperations({
      type: "object",
      properties: { price: { type: "string" } },
    });

    const issues = checkResponseCompatibility(oldOperations, newOperations);

    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /number.*string/);
  });

  it("does not report an unchanged response schema", () => {
    const operations = createOperations({
      type: "object",
      properties: { price: { type: "number" } },
    });

    const issues = checkResponseCompatibility(operations, operations);

    assert.equal(issues.length, 0);
  });

  it("detects a nested response property type change", () => {
    const oldOperations = createOperations({
      type: "object",
      properties: {
        category: {
          type: "object",
          properties: { name: { type: "string" } },
        },
      },
    });

    const newOperations = createOperations({
      type: "object",
      properties: {
        category: {
          type: "object",
          properties: { name: { type: "integer" } },
        },
      },
    });

    const issues = checkResponseCompatibility(oldOperations, newOperations);

    assert.ok(
      issues.some(
        (issue) =>
          issue.message.includes("category.name") &&
          issue.message.includes("string") &&
          issue.message.includes("integer")
      )
    );
  });

  it("detects a response enum expansion", () => {
    const oldOperations = createOperations({
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending"] },
      },
    });

    const newOperations = createOperations({
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "active"] },
      },
    });

    const issues = checkResponseCompatibility(oldOperations, newOperations);

    assert.ok(
      issues.some(
        (issue) =>
          issue.message.includes("active") &&
          issue.message.includes("enum")
      )
    );
  });

  it("detects a response format change", () => {
    const oldOperations = createOperations({
      type: "object",
      properties: {
        createdAt: { type: "string", format: "date-time" },
      },
    });

    const newOperations = createOperations({
      type: "object",
      properties: {
        createdAt: { type: "string", format: "date" },
      },
    });

    const issues = checkResponseCompatibility(oldOperations, newOperations);

    assert.ok(
      issues.some(
        (issue) =>
          issue.message.includes("date-time") &&
          issue.message.includes("date")
      )
    );
  });

  it("detects a removed response content type", () => {
    const oldOperations: OperationMap = new Map([
      [
        "GET /products/{id}",
        {
          responses: {
            "200": {
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
        },
      ],
    ]);

    const newOperations: OperationMap = new Map([
      [
        "GET /products/{id}",
        {
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      ],
    ]);

    const issues = checkResponseCompatibility(oldOperations, newOperations);

    assert.ok(
      issues.some((issue) => issue.message.includes("application/xml"))
    );
  });

  it("detects a removed response property", () => {
    const oldOperations = createOperations({
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
      },
    });

    const newOperations = createOperations({
      type: "object",
      properties: {
        id: { type: "integer" },
      },
    });

    const issues = checkResponseCompatibility(oldOperations, newOperations);

    assert.ok(
      issues.some((issue) => issue.message.includes("name"))
    );
  });

  it("detects a required response property becoming optional", () => {
    const oldOperations = createOperations({
      type: "object",
      properties: {
        id: { type: "integer" },
      },
      required: ["id"],
    });

    const newOperations = createOperations({
      type: "object",
      properties: {
        id: { type: "integer" },
      },
      required: [],
    });

    const issues = checkResponseCompatibility(oldOperations, newOperations);

    assert.ok(
      issues.some(
        (issue) =>
          issue.message.includes("id") &&
          issue.message.includes("optional")
      ),
      "Expected the required-to-optional change to be reported"
    );
  });

  
  it("detects removal of a response schema", () => {
    const oldOperations: OperationMap = new Map([
      [
        "GET /products/{id}",
        {
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      ],
    ]);

    const newOperations: OperationMap = new Map([
      [
        "GET /products/{id}",
        {
          responses: {
            "200": {
              content: {
                "application/json": {},
              },
            },
          },
        },
      ],
    ]);

    const issues = checkResponseCompatibility(
      oldOperations,
      newOperations
    );

    assert.ok(
      issues.some((issue) => issue.message.includes("schema")),
      "Expected response schema removal to be reported"
    );
  });

  it("does not flag an added response content type as breaking", () => {
    const oldOperations: OperationMap = new Map([
      [
        "GET /products/{id}",
        {
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      ],
    ]);

    const newOperations: OperationMap = new Map([
      [
        "GET /products/{id}",
        {
          responses: {
            "200": {
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
        },
      ],
    ]);

    const issues = checkResponseCompatibility(
      oldOperations,
      newOperations
    );

    assert.equal(issues.length, 0);
  });

  it("detects a response becoming nullable in a nested property", () => {
    const oldOperations: OperationMap = new Map([
      [
        "GET /products/{id}",
        {
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      category: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            nullable: false,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    ]);

    const newOperations: OperationMap = new Map([
      [
        "GET /products/{id}",
        {
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      category: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            nullable: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    ]);

    const issues = checkResponseCompatibility(
      oldOperations,
      newOperations
    );

    assert.ok(
      issues.some(
        (issue) =>
          issue.message.includes("category.name") &&
          issue.message.includes("nullable")
      ),
      "Expected nested nullable change to be reported"
    );
  });


});
