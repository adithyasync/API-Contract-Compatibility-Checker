
import type {
  OperationMap,
  RequestSchema,
} from "../parser/operationExtractor.js";

export type RequestBodyIssue = {
  operation: string;
  message: string;
  severity: "breaking";
};

export function checkRequestBodyCompatibility(
  oldOperations: OperationMap,
  newOperations: OperationMap
): RequestBodyIssue[] {
  const issues: RequestBodyIssue[] = [];

  for (const [operationKey, oldOperation] of oldOperations) {
    const newOperation = newOperations.get(operationKey);
    if (!newOperation) continue;

    const oldBody = oldOperation.requestBody;
    const newBody = newOperation.requestBody;

    // Removing a previously required request body is breaking.
    if (oldBody?.required && !newBody) {
      issues.push({
        operation: operationKey,
        message: "Previously required request body was removed",
        severity: "breaking",
      });
      continue;
    }

    // Making an optional request body required is breaking.
    if (!oldBody?.required && newBody?.required) {
      issues.push({
        operation: operationKey,
        message: "Request body changed from optional to required",
        severity: "breaking",
      });
    }

    if (!oldBody || !newBody) continue;

    const oldContent = oldBody.content ?? {};
    const newContent = newBody.content ?? {};

    for (const [contentType, oldMedia] of Object.entries(oldContent)) {
      const newMedia = newContent[contentType];

      // Removing a previously supported content type is breaking.
      if (!newMedia) {
        issues.push({
          operation: operationKey,
          message: `Request content type '${contentType}' was removed`,
          severity: "breaking",
        });
        continue;
      }

      const oldSchema = oldMedia?.schema;
      const newSchema = newMedia.schema;

      // Removing a previously declared schema can leave the request
      // contract too vague for existing clients.
      if (oldSchema && !newSchema) {
        issues.push({
          operation: operationKey,
          message: `Request schema for '${contentType}' was removed`,
          severity: "breaking",
        });
        continue;
      }

      if (!oldSchema || !newSchema) continue;

      compareSchemas(
        operationKey,
        oldSchema,
        newSchema,
        issues,
        contentType
      );
    }
  }

  return issues;
}

function compareSchemas(
  operation: string,
  oldSchema: RequestSchema,
  newSchema: RequestSchema,
  issues: RequestBodyIssue[],
  location: string
): void {
  const oldProperties = oldSchema.properties ?? {};
  const newProperties = newSchema.properties ?? {};
  const oldRequired = new Set(oldSchema.required ?? []);
  const newRequired = new Set(newSchema.required ?? []);

  for (const property of Object.keys(newProperties)) {
    const existedBefore = property in oldProperties;

    if (newRequired.has(property) && !oldRequired.has(property)) {
      issues.push({
        operation,
        message: existedBefore
          ? `Request field '${location}.${property}' changed from optional to required`
          : `New required request field '${location}.${property}' was added`,
        severity: "breaking",
      });
    }
  }

  for (const [property, oldProperty] of Object.entries(oldProperties)) {
    const newProperty = newProperties[property];
    if (!newProperty) continue;

    const fieldLocation = `${location}.${property}`;

    if (
      oldProperty.type &&
      newProperty.type &&
      oldProperty.type !== newProperty.type
    ) {
      issues.push({
        operation,
        message:
          `Request field '${fieldLocation}' changed type from ` +
          `'${oldProperty.type}' to '${newProperty.type}'`,
        severity: "breaking",
      });
    }

    const oldEnum = getEnumValues(oldProperty);
    const newEnum = getEnumValues(newProperty);

    if (newEnum !== undefined) {
      const removedValues =
        oldEnum === undefined
          ? []
          : oldEnum.filter(
              (value) => !newEnum.some((newValue) => areEqual(newValue, value))
            );

      if (oldEnum === undefined || removedValues.length > 0) {
        issues.push({
          operation,
          message:
            oldEnum === undefined
              ? `Request field '${fieldLocation}' now restricts allowed values with an enum`
              : `Request field '${fieldLocation}' removed allowed enum value(s): ` +
                removedValues.map(formatEnumValue).join(", "),
          severity: "breaking",
        });
      }
    }

    if (
      typeof oldProperty.format === "string" &&
      typeof newProperty.format === "string" &&
      oldProperty.format !== newProperty.format
    ) {
      issues.push({
        operation,
        message:
          `Request field '${fieldLocation}' changed format from ` +
          `'${oldProperty.format}' to '${newProperty.format}'`,
        severity: "breaking",
      });
    }

    if (oldProperty.properties && newProperty.properties) {
      compareSchemas(
        operation,
        oldProperty,
        newProperty,
        issues,
        fieldLocation
      );
    }

    if (oldProperty.items && newProperty.items) {
      compareSchemas(
        operation,
        oldProperty.items,
        newProperty.items,
        issues,
        `${fieldLocation}[]`
      );
    }
  }
}

function getEnumValues(
  schema: RequestSchema
): unknown[] | undefined {
  const value: unknown = schema["enum"];
  return Array.isArray(value) ? value : undefined;
}

function areEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatEnumValue(value: unknown): string {
  return JSON.stringify(value) ?? String(value);
}
