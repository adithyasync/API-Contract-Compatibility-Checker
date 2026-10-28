
import SwaggerParser from "@apidevtools/swagger-parser";

import { extractOperations } from "../parser/operationExtractor.js";
import { checkRequestCompatibility } from "./requestChecker.js";
import { checkResponseCompatibility } from "./responseChecker.js";
import { checkRequestBodyCompatibility } from "./requestBodyChecker.js";

import type {
  CompatibilityIssue,
  CompatibilityReport,
} from "./reportTypes.js";

/**
 * Compare two OpenAPI specification files and return a compatibility report.
 *
 * The old specification represents the existing API contract.
 * The new specification represents the proposed API contract.
 */
export async function compareSpecifications(
  oldSpecPath: string,
  newSpecPath: string
): Promise<CompatibilityReport> {
  // Validate both contracts before comparing them.
  const oldDocument = await SwaggerParser.validate(oldSpecPath);
  const newDocument = await SwaggerParser.validate(newSpecPath);

  // Extract operations from both contracts.
  const oldOperations = await extractOperations(oldSpecPath);
  const newOperations = await extractOperations(newSpecPath);

  const issues: CompatibilityIssue[] = [];

  // 1. Detect removed operations.
  for (const operation of oldOperations.keys()) {
    if (!newOperations.has(operation)) {
      issues.push({
        operation,
        message: "Operation was removed",
        severity: "breaking",
        category: "operation",
      });
    }
  }

  // 2. Detect request parameter changes.
  const requestIssues = checkRequestCompatibility(
    oldOperations,
    newOperations
  );

  issues.push(
    ...requestIssues.map((issue) => ({
      ...issue,
      category: "parameter" as const,
    }))
  );

  // 3. Detect response changes.
  const responseIssues = checkResponseCompatibility(
    oldOperations,
    newOperations
  );

  issues.push(
    ...responseIssues.map((issue) => ({
      ...issue,
      category: "response" as const,
    }))
  );

  // 4. Detect request-body changes.
  const bodyIssues = checkRequestBodyCompatibility(
    oldOperations,
    newOperations
  );

  issues.push(
    ...bodyIssues.map((issue) => ({
      ...issue,
      category: "request-body" as const,
    }))
  );

  // Build the report using the versions declared in each contract.
  const report: CompatibilityReport = {
    oldVersion: oldDocument.info.version,
    newVersion: newDocument.info.version,
    compatible: issues.length === 0,
    summary: {
      totalIssues: issues.length,
      breakingChanges: issues.filter(
        (issue) => issue.severity === "breaking"
      ).length,
    },
    issues,
  };

  return report;
}
