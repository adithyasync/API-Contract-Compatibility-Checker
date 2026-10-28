
import type { OperationMap } from "../parser/operationExtractor.js";

export type CompatibilityIssue = {
  operation: string;
  message: string;
  severity: "breaking";
};

type SchemaObject = {
  type?: string;
  format?: string;
  enum?: unknown[];
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
};

type ResponseObject = {
  content?: Record<
    string,
    {
      schema?: SchemaObject;
    }
  >;
};

type DetailedOperation = {
  responses?: Record<string, ResponseObject>;
};

export function checkResponseCompatibility(
  oldOperations: OperationMap,
  newOperations: OperationMap
): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];

  for (const [operationKey, oldOperation] of oldOperations) {
    const newOperation = newOperations.get(operationKey);

    if (!newOperation) continue;

    const oldResponses =
      (oldOperation as DetailedOperation).responses ?? {};
    const newResponses =
      (newOperation as DetailedOperation).responses ?? {};

    // Detect removed response status codes.
    for (const statusCode of Object.keys(oldResponses)) {
      if (!(statusCode in newResponses)) {
        issues.push({
          operation: operationKey,
          message: `Response status ${statusCode} was removed`,
          severity: "breaking",
        });
      }
    }

    for (const [statusCode, oldResponse] of Object.entries(oldResponses)) {
      const newResponse = newResponses[statusCode];
      if (!newResponse) continue;

      const oldContent = oldResponse.content ?? {};
      const newContent = newResponse.content ?? {};

      // Detect removed response content types.
      for (const contentType of Object.keys(oldContent)) {
        if (!(contentType in newContent)) {
          issues.push({
            operation: operationKey,
            message:
              `Response content type '${contentType}' was removed ` +
              `from status ${statusCode}`,
            severity: "breaking",
          });
        }
      }

      
      // Compare schemas for matching content types.
      for (const [contentType, oldMedia] of Object.entries(oldContent)) {
        const newMedia = newContent[contentType];

        // The removed content type has already been reported above.
        if (!newMedia) continue;

        // A previously declared response schema was removed.
        if (oldMedia.schema && !newMedia.schema) {
          issues.push({
            operation: operationKey,
            message:
              `Response schema for '${contentType}' was removed ` +
              `from status ${statusCode}`,
            severity: "breaking",
          });
          continue;
        }

        if (!oldMedia.schema || !newMedia.schema) continue;

        compareResponseSchemas(
          operationKey,
          statusCode,
          oldMedia.schema,
          newMedia.schema,
          contentType,
          issues
        );
      }      
    }
  }

  return issues;
}

function compareResponseSchemas(
  operation: string,
  statusCode: string,
  oldSchema: SchemaObject,
  newSchema: SchemaObject,
  location: string,
  issues: CompatibilityIssue[]
): void {
  if (
    oldSchema.type &&
    newSchema.type &&
    oldSchema.type !== newSchema.type
  ) {
    issues.push({
      operation,
      message:
        `Response schema '${location}' changed type from ` +
        `'${oldSchema.type}' to '${newSchema.type}' ` +
        `in status ${statusCode}`,
      severity: "breaking",
    });

    return;
  }

  // A response format change may alter the representation clients receive.
  if (
    oldSchema.format &&
    newSchema.format &&
    oldSchema.format !== newSchema.format
  ) {
    issues.push({
      operation,
      message:
        `Response schema '${location}' changed format from ` +
        `'${oldSchema.format}' to '${newSchema.format}' ` +
        `in status ${statusCode}`,
      severity: "breaking",
    });
  }

  // Adding response enum values may expose values old clients do not handle.
  if (oldSchema.enum && newSchema.enum) {
    const addedValues = newSchema.enum.filter(
      (value) =>
        !oldSchema.enum!.some(
          (oldValue) => areEqual(oldValue, value)
        )
    );

    if (addedValues.length > 0) {
      issues.push({
        operation,
        message:
          `Response schema '${location}' added enum value(s): ` +
          `${addedValues.map(formatEnumValue).join(", ")} ` +
          `in status ${statusCode}`,
        severity: "breaking",
      });
    }
  }

  // A response becoming nullable may require clients to handle null.
  if (oldSchema.nullable !== true && newSchema.nullable === true) {
    issues.push({
      operation,
      message:
        `Response schema '${location}' became nullable ` +
        `in status ${statusCode}`,
      severity: "breaking",
    });
  }

  checkResponseConstraints(
    operation,
    statusCode,
    oldSchema,
    newSchema,
    location,
    issues
  );


    const oldRequired = new Set(oldSchema.required ?? []);
    const newRequired = new Set(newSchema.required ?? []);

    for (const property of oldRequired) {
      if (!newRequired.has(property)) {
        issues.push({
          operation,
          message:
            `Required response property '${location}.${property}' ` +
            `became optional in status ${statusCode}`,
          severity: "breaking",
        });
      }
    }

  // Recursively compare object properties.
  for (const [property, oldProperty] of Object.entries(
    oldSchema.properties ?? {}
  )) {
    const newProperty = newSchema.properties?.[property];
    const propertyLocation = `${location}.${property}`;

    if (!newProperty) {
      issues.push({
        operation,
        message:
          `Response property '${propertyLocation}' was removed ` +
          `from status ${statusCode}`,
        severity: "breaking",
      });
      continue;
    }

    compareResponseSchemas(
      operation,
      statusCode,
      oldProperty,
      newProperty,
      propertyLocation,
      issues
    );
  }

  // Recursively compare array item schemas.
  if (oldSchema.items && newSchema.items) {
    compareResponseSchemas(
      operation,
      statusCode,
      oldSchema.items,
      newSchema.items,
      `${location}[]`,
      issues
    );
  }
}

function areEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatEnumValue(value: unknown): string {
  return JSON.stringify(value) ?? String(value);
}

function checkResponseConstraints(
  operation: string,
  statusCode: string,
  oldSchema: SchemaObject,
  newSchema: SchemaObject,
  location: string,
  issues: CompatibilityIssue[]
): void {
  const constraints: Array<{
    key: keyof SchemaObject;
    direction: "minimum" | "maximum";
  }> = [
    { key: "minimum", direction: "minimum" },
    { key: "maximum", direction: "maximum" },
    { key: "minLength", direction: "minimum" },
    { key: "maxLength", direction: "maximum" },
    { key: "minItems", direction: "minimum" },
    { key: "maxItems", direction: "maximum" },
  ];

  for (const constraint of constraints) {
    const oldValue = oldSchema[constraint.key];
    const newValue = newSchema[constraint.key];

    if (
      typeof oldValue !== "number" ||
      typeof newValue !== "number"
    ) {
      continue;
    }

    const isMoreRestrictive =
      constraint.direction === "minimum"
        ? newValue > oldValue
        : newValue < oldValue;

    if (isMoreRestrictive) {
      issues.push({
        operation,
        message:
          `Response schema '${location}' tightened constraint ` +
          `'${constraint.key}' from ${oldValue} to ${newValue} ` +
          `in status ${statusCode}`,
        severity: "breaking",
      });
    }
  }
}