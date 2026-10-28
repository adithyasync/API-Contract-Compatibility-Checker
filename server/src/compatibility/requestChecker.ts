
import type {
  OperationMap,
  ParameterObject,
} from "../parser/operationExtractor.js";

export type RequestCompatibilityIssue = {
  operation: string;
  message: string;
  severity: "breaking";
};

export function checkRequestCompatibility(
  oldOperations: OperationMap,
  newOperations: OperationMap
): RequestCompatibilityIssue[] {
  const issues: RequestCompatibilityIssue[] = [];

  for (const [operationKey, oldOperation] of oldOperations) {
    const newOperation = newOperations.get(operationKey);

    // New or removed operations are handled by the main checker.
    if (!newOperation) continue;

    const oldParameters = oldOperation.parameters ?? [];
    const newParameters = newOperation.parameters ?? [];

    // Detect removed parameters.
    for (const oldParameter of oldParameters) {
      const stillExists = newParameters.some(
        (parameter) =>
          parameter.name === oldParameter.name &&
          parameter.in === oldParameter.in
      );

      if (!stillExists) {
        issues.push({
          operation: operationKey,
          message:
            `Parameter '${oldParameter.name}' in ${oldParameter.in} ` +
            `was removed`,
          severity: "breaking",
        });
      }
    }

    for (const newParameter of newParameters) {
      const oldParameter = oldParameters.find(
        (parameter) =>
          parameter.name === newParameter.name &&
          parameter.in === newParameter.in
      );

      // A newly introduced required parameter can break existing clients.
      if (!oldParameter && newParameter.required) {
        issues.push({
          operation: operationKey,
          message:
            `New required ${newParameter.in} parameter ` +
            `'${newParameter.name}' was added`,
          severity: "breaking",
        });
      }

      if (!oldParameter) continue;

      // Making an existing optional parameter required can break clients.
      if (!oldParameter.required && newParameter.required) {
        issues.push({
          operation: operationKey,
          message:
            `Parameter '${newParameter.name}' in ${newParameter.in} ` +
            `changed from optional to required`,
          severity: "breaking",
        });
      }

      const oldSchema = oldParameter.schema;
      const newSchema = newParameter.schema;

      if (!oldSchema || !newSchema) continue;

      // Detect declared type changes.
      const oldType = oldSchema.type;
      const newType = newSchema.type;

      if (oldType && newType && oldType !== newType) {
        issues.push({
          operation: operationKey,
          message:
            `Parameter '${newParameter.name}' in ${newParameter.in} ` +
            `changed type from '${oldType}' to '${newType}'`,
          severity: "breaking",
        });
      }

      // Detect changes to explicitly declared formats.
      const oldFormat = oldSchema.format;
      const newFormat = newSchema.format;

      if (
        typeof oldFormat === "string" &&
        typeof newFormat === "string" &&
        oldFormat !== newFormat
      ) {
        issues.push({
          operation: operationKey,
          message:
            `Parameter '${newParameter.name}' in ${newParameter.in} ` +
            `changed format from '${oldFormat}' to '${newFormat}'`,
          severity: "breaking",
        });
      }

      // Restricting previously accepted parameter values can break clients.
      const oldEnum = getEnumValues(oldSchema);
      const newEnum = getEnumValues(newSchema);

      if (newEnum !== undefined) {
        const removedValues =
          oldEnum === undefined
            ? []
            : oldEnum.filter(
                (value) =>
                  !newEnum.some((newValue) => areEqual(value, newValue))
              );

        if (oldEnum === undefined || removedValues.length > 0) {
          issues.push({
            operation: operationKey,
            message:
              oldEnum === undefined
                ? `Parameter '${newParameter.name}' in ${newParameter.in} ` +
                  `now restricts allowed values with an enum`
                : `Parameter '${newParameter.name}' in ${newParameter.in} ` +
                  `removed allowed enum value(s): ` +
                  removedValues.map(formatEnumValue).join(", "),
            severity: "breaking",
          });
        }
      }
    }
  }

  return issues;
}

function getEnumValues(
  schema: NonNullable<ParameterObject["schema"]>
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
