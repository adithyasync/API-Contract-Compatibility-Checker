
export type CompatibilityIssue = {
  operation: string;
  message: string;
  severity: "breaking";
  category:
    | "operation"
    | "parameter"
    | "response"
    | "request-body";
};

export type CompatibilityReport = {
  oldVersion: string;
  newVersion: string;
  compatible: boolean;
  summary: {
    totalIssues: number;
    breakingChanges: number;
  };
  issues: CompatibilityIssue[];
};
