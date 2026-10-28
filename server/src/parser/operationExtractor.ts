
import SwaggerParser from "@apidevtools/swagger-parser";

export type RequestSchema = {
  type?: string;
  properties?: Record<string, RequestSchema>;
  required?: string[];
  items?: RequestSchema;
  format?: string;
  [key: string]: unknown;
};

export type RequestBodyObject = {
  required?: boolean;
  content?: Record<
    string,
    {
      schema?: RequestSchema;
    }
  >;
};


export type ParameterObject = {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  required?: boolean | undefined;
  schema?: {
    type?: string;
    format?: string;
    [key: string]: unknown;
  } | undefined;
};


export type OperationObject = {
  summary?: string;
  operationId?: string;
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject | undefined;
  responses?: Record<string, unknown>;
};

export type OperationMap = Map<string, OperationObject>;

const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "trace",
] as const;


function normalizeParameter(parameter: any): ParameterObject {
  return {
    name: parameter.name,
    in: parameter.in as ParameterObject["in"],
    ...(parameter.required !== undefined
      ? { required: parameter.required }
      : {}),
    ...(parameter.schema !== undefined
      ? { schema: parameter.schema as ParameterObject["schema"] }
      : {}),
  };
}


/**
 * Combines path-level and operation-level parameters.
 * An operation-level parameter overrides a path-level parameter
 * with the same name and location.
 */
function mergeParameters(
  pathParameters: any[] = [],
  operationParameters: any[] = []
): ParameterObject[] {
  const merged = new Map<string, ParameterObject>();

  for (const parameter of pathParameters) {
    const normalized = normalizeParameter(parameter);
    const key = `${normalized.in}:${normalized.name}`;

    merged.set(key, normalized);
  }

  for (const parameter of operationParameters) {
    const normalized = normalizeParameter(parameter);
    const key = `${normalized.in}:${normalized.name}`;

    // Operation-level parameters take precedence.
    merged.set(key, normalized);
  }

  return Array.from(merged.values());
}

export async function extractOperations(
  filePath: string
): Promise<OperationMap> {
  const api = await SwaggerParser.validate(filePath);
  const operations: OperationMap = new Map();

  for (const [route, pathItem] of Object.entries(api.paths ?? {})) {
    if (!pathItem) continue;

    const pathParameters = (pathItem as any).parameters ?? [];

    for (const method of HTTP_METHODS) {
      const operation = (pathItem as any)[method];

      if (!operation) continue;

      const key = `${method.toUpperCase()} ${route}`;

      operations.set(key, {
        summary: operation.summary,
        operationId: operation.operationId,
        parameters: mergeParameters(
          pathParameters,
          operation.parameters ?? []
        ),
        requestBody: operation.requestBody as
          | RequestBodyObject
          | undefined,
        responses: operation.responses,
      });
    }
  }

  return operations;
}
