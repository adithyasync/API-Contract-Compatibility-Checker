
import SpecificationDiff from "./components/SpecificationDiff";
import { useState } from "react";
import "./App.css";

type CompatibilityIssue = {
  operation: string;
  message: string;
  severity: "breaking";
  category: "operation" | "parameter" | "response" | "request-body";
};

type CompatibilityReport = {
  oldVersion: string;
  newVersion: string;
  compatible: boolean;
  summary: {
    totalIssues: number;
    breakingChanges: number;
  };
  issues: CompatibilityIssue[];
};

type InputMode = "demo" | "paste" | "upload";
type ExampleKey = "required-parameter" | "removed-operation";

type Example = {
  label: string;
  description: string;
  oldSpec: string;
  newSpec: string;
};

const requiredParameterExample: Example = {
  label: "Required query parameter",
  description: "An optional parameter becomes required.",
  oldSpec: `openapi: 3.0.3
info:
  title: Product API
  version: 1.0.0
paths:
  /products:
    get:
      summary: List products
      operationId: listProducts
      parameters:
        - name: limit
          in: query
          required: false
          schema:
            type: integer
      responses:
        "200":
          description: Products returned successfully
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    id:
                      type: integer
                    name:
                      type: string
`,
  newSpec: `openapi: 3.0.3
info:
  title: Product API
  version: 2.0.0
paths:
  /products:
    get:
      summary: List products
      operationId: listProducts
      parameters:
        - name: limit
          in: query
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Products returned successfully
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    id:
                      type: integer
                    name:
                      type: string
`,
};

const removedOperationExample: Example = {
  label: "Removed API endpoint",
  description: "An endpoint supported by the old contract disappears.",
  oldSpec: `openapi: 3.0.3
info:
  title: Product API
  version: 1.0.0
paths:
  /products:
    get:
      summary: List products
      responses:
        "200":
          description: Products returned successfully
  /products/{productId}:
    get:
      summary: Get a product
      parameters:
        - name: productId
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Product returned successfully
`,
  newSpec: `openapi: 3.0.3
info:
  title: Product API
  version: 2.0.0
paths:
  /products:
    get:
      summary: List products
      responses:
        "200":
          description: Products returned successfully
`,
};

const examples: Record<ExampleKey, Example> = {
  "required-parameter": requiredParameterExample,
  "removed-operation": removedOperationExample,
};

function App() {
  const [mode, setMode] = useState<InputMode>("demo");
  const [exampleKey, setExampleKey] =
    useState<ExampleKey>("required-parameter");

  const [oldSpecText, setOldSpecText] = useState(
    requiredParameterExample.oldSpec
  );
  const [newSpecText, setNewSpecText] = useState(
    requiredParameterExample.newSpec
  );

  const [oldFile, setOldFile] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [report, setReport] = useState<CompatibilityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [comparedOldSpec, setComparedOldSpec] = useState("");
  const [comparedNewSpec, setComparedNewSpec] = useState("");
  const [showDiff, setShowDiff] = useState(false);

  function changeMode(nextMode: InputMode) {
    setMode(nextMode);
    setError("");
    setReport(null);
  }

  function loadExample(nextKey: ExampleKey) {
    const example = examples[nextKey];

    setExampleKey(nextKey);
    setOldSpecText(example.oldSpec);
    setNewSpecText(example.newSpec);
    setReport(null);
    setError("");
    setSearchTerm("");
    setCategoryFilter("all");
  }

  async function compareContracts() {
    setError("");
    setReport(null);
    setSearchTerm("");
    setCategoryFilter("all");
    setShowDiff(false);

    const formData = new FormData();

    if (mode === "upload") {
      if (!oldFile || !newFile) {
        setError("Please select both the current and proposed specification files.");
        return;
      }

      formData.append("oldSpec", oldFile);
      formData.append("newSpec", newFile);
    } else {
      if (!oldSpecText.trim() || !newSpecText.trim()) {
        setError("Please provide both the current and proposed specifications.");
        return;
      }

      formData.append("oldSpecText", oldSpecText);
      formData.append("newSpecText", newSpecText);
    }

    const oldText =
      mode === "upload" ? await oldFile!.text() : oldSpecText;

    const newText =
      mode === "upload" ? await newFile!.text() : newSpecText;

    setComparedOldSpec(oldText);
    setComparedNewSpec(newText);

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:3000/api/compatibility/check",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ?? data.error ?? "Comparison failed."
        );
      }

      setReport(data as CompatibilityReport);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the API server."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredIssues = (report?.issues ?? []).filter((issue) => {
    const query = searchTerm.toLowerCase().trim();

    const matchesSearch =
      issue.operation.toLowerCase().includes(query) ||
      issue.message.toLowerCase().includes(query) ||
      issue.category.toLowerCase().includes(query);

    const matchesCategory =
      categoryFilter === "all" || issue.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  function downloadReport(format: "json" | "markdown") {
    if (!report) return;

    let content: string;
    let mimeType: string;
    let extension: string;

    if (format === "json") {
      content = JSON.stringify(report, null, 2);
      mimeType = "application/json";
      extension = "json";
    } else {
      const findings = report.issues.length
        ? report.issues
            .map(
              (issue, index) =>
                `${index + 1}. **[${issue.category.toUpperCase()}] ${issue.operation}**\n` +
                `   - Severity: ${issue.severity}\n` +
                `   - Finding: ${issue.message}`
            )
            .join("\n\n")
        : "No compatibility issues detected.";

      content = [
        "# API Contract Guardian — Compatibility Report",
        "",
        `- **Old version:** ${report.oldVersion}`,
        `- **New version:** ${report.newVersion}`,
        `- **Compatible:** ${report.compatible ? "Yes" : "No"}`,
        `- **Total issues:** ${report.summary.totalIssues}`,
        `- **Breaking changes:** ${report.summary.breakingChanges}`,
        "",
        "## Findings",
        "",
        findings,
        "",
      ].join("\n");

      mimeType = "text/markdown";
      extension = "md";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `api-compatibility-report.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-icon">G</span>
          <span>API Contract Guardian</span>
        </a>

        <span className="status">
          <span className="status-dot" />
          Contract analysis
        </span>
      </header>

      <section className="hero">
        <p className="eyebrow">API QUALITY · COMPATIBILITY · CONFIDENCE</p>
        <h1>
          Catch breaking changes
          <br />
          before they reach production.
        </h1>
        <p className="hero-description">
          Compare two OpenAPI contracts and identify changes that could break
          existing API consumers.
        </p>
      </section>

      <section className="comparison-panel">
        <div className="section-heading">
          <div>
            <h2>Compare contracts</h2>
            <p>
              Start with the demo, explore examples, or use your own contracts.
            </p>
          </div>
          <span className="file-format">OpenAPI · YAML / JSON</span>
        </div>

        <div className="mode-selector" role="tablist" aria-label="Input method">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "demo"}
            className={`mode-tab ${mode === "demo" ? "active" : ""}`}
            onClick={() => changeMode("demo")}
          >
            <span className="mode-tab-icon">▶</span>
            <span>
              <strong>Try demo</strong>
              <small>Ready-made example</small>
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === "paste"}
            className={`mode-tab ${mode === "paste" ? "active" : ""}`}
            onClick={() => changeMode("paste")}
          >
            <span className="mode-tab-icon">{"</>"}</span>
            <span>
              <strong>Paste / Edit</strong>
              <small>Use example snippets</small>
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === "upload"}
            className={`mode-tab ${mode === "upload" ? "active" : ""}`}
            onClick={() => changeMode("upload")}
          >
            <span className="mode-tab-icon">↑</span>
            <span>
              <strong>Upload files</strong>
              <small>Use your own specs</small>
            </span>
          </button>
        </div>

        {mode === "demo" && (
          <div className="mode-content">
            <div className="demo-intro">
              <span className="demo-label">INTERACTIVE DEMO</span>
              <h3>See a breaking change in action</h3>
              <p>
                The Product API has two versions. In the new version, the
                <code> limit </code>
                query parameter becomes required. Older clients that omit it
                may stop working.
              </p>
              <div className="demo-facts">
                <span>Current: v1.0.0</span>
                <span aria-hidden="true">→</span>
                <span>Proposed: v2.0.0</span>
                <span className="demo-change-tag">Optional → Required</span>
              </div>
            </div>

            <div className="demo-spec-grid">
              <article className="spec-preview">
                <div className="spec-preview-heading">
                  <span>01</span>
                  <strong>Current contract</strong>
                  <small>v1.0.0</small>
                </div>
                <pre>{`GET /products
limit: optional
Response: 200 OK`}</pre>
              </article>

              <article className="spec-preview">
                <div className="spec-preview-heading">
                  <span>02</span>
                  <strong>Proposed contract</strong>
                  <small>v2.0.0</small>
                </div>
                <pre>{`GET /products
limit: required
Response: 200 OK`}</pre>
              </article>
            </div>

            <p className="demo-note">
              These specifications are sent to your backend and checked by
              your compatibility engine. The result is not a hardcoded demo.
            </p>

            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                changeMode("paste");
                loadExample("required-parameter");
              }}
            >
              Inspect or edit the full specifications →
            </button>
          </div>
        )}

        {mode === "paste" && (
          <div className="mode-content">
            <div className="editor-intro">
              <div>
                <h3>Paste or edit specifications</h3>
                <p>
                  Choose a scenario to prefill both editors, then modify the
                  YAML or JSON as needed.
                </p>
              </div>
            </div>

            <label className="example-picker-label" htmlFor="example-picker">
              Load an example
            </label>
            <select
              id="example-picker"
              className="example-picker"
              value={exampleKey}
              onChange={(event) =>
                loadExample(event.target.value as ExampleKey)
              }
            >
              <option value="required-parameter">
                Required query parameter
              </option>
              <option value="removed-operation">Removed API endpoint</option>
            </select>

            <p className="example-description">
              {examples[exampleKey].description}
            </p>

            <div className="editor-grid">
              <label className="spec-editor-card">
                <span className="editor-heading">
                  <strong>Current contract</strong>
                  <small>Old version</small>
                </span>
                <textarea
                  className="spec-editor"
                  spellCheck={false}
                  value={oldSpecText}
                  onChange={(event) => {
                    setOldSpecText(event.target.value);
                    setReport(null);
                  }}
                  placeholder="Paste your current OpenAPI YAML or JSON here..."
                  aria-label="Current OpenAPI specification"
                />
              </label>

              <label className="spec-editor-card">
                <span className="editor-heading">
                  <strong>Proposed contract</strong>
                  <small>New version</small>
                </span>
                <textarea
                  className="spec-editor"
                  spellCheck={false}
                  value={newSpecText}
                  onChange={(event) => {
                    setNewSpecText(event.target.value);
                    setReport(null);
                  }}
                  placeholder="Paste your proposed OpenAPI YAML or JSON here..."
                  aria-label="Proposed OpenAPI specification"
                />
              </label>
            </div>

            <p className="editor-tip">
              Tip: Start with an example, change one thing, and run the
              comparison to see whether it introduces a breaking change.
            </p>
          </div>
        )}

        {mode === "upload" && (
          <div className="mode-content">
            <div className="editor-intro">
              <div>
                <h3>Upload your OpenAPI contracts</h3>
                <p>
                  Select the existing specification and the proposed version.
                </p>
              </div>
            </div>

            <div className="upload-grid">
              <label className="upload-card">
                <span className="upload-icon">01</span>
                <strong>Current contract</strong>
                <span className="upload-description">
                  The existing API specification
                </span>
                <input
                  type="file"
                  accept=".yaml,.yml,.json,application/json"
                  onChange={(event) => {
                    setOldFile(event.target.files?.[0] ?? null);
                    setReport(null);
                    setError("");
                  }}
                />
                <span className="file-name">
                  {oldFile ? oldFile.name : "Choose a file"}
                </span>
              </label>

              <label className="upload-card">
                <span className="upload-icon">02</span>
                <strong>Proposed contract</strong>
                <span className="upload-description">
                  The version you want to validate
                </span>
                <input
                  type="file"
                  accept=".yaml,.yml,.json,application/json"
                  onChange={(event) => {
                    setNewFile(event.target.files?.[0] ?? null);
                    setReport(null);
                    setError("");
                  }}
                />
                <span className="file-name">
                  {newFile ? newFile.name : "Choose a file"}
                </span>
              </label>
            </div>

            <p className="editor-tip">
              Supported formats: .yaml, .yml, and .json. Maximum upload size:
              2 MB per file.
            </p>
          </div>
        )}

        <button
          className="compare-button"
          type="button"
          onClick={compareContracts}
          disabled={loading}
        >
          {loading
            ? "Comparing contracts..."
            : mode === "demo"
              ? "Run Demo Compatibility Check →"
              : "Compare contracts →"}
        </button>

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </section>

      {report && (
        <section className="results">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ANALYSIS RESULTS</p>
              <h2>Compatibility report</h2>

              <div className="export-actions">
                <button
                  className="export-button"
                  type="button"
                  onClick={() => downloadReport("json")}
                >
                  Download JSON ↓
                </button>

                <button
                  className="export-button"
                  type="button"
                  onClick={() => downloadReport("markdown")}
                >
                  Download Markdown ↓
                </button>
              </div>

              <p>
                {report.oldVersion} → {report.newVersion}
              </p>
            </div>

            <span
              className={`result-status ${
                report.compatible ? "compatible" : "incompatible"
              }`}
            >
              {report.compatible ? "Compatible" : "Breaking changes found"}
            </span>
          </div>

          <div className="stats-grid">
            <article className="stat-card">
              <span>Total issues</span>
              <strong>{report.summary.totalIssues}</strong>
            </article>
            <article className="stat-card">
              <span>Breaking changes</span>
              <strong>{report.summary.breakingChanges}</strong>
            </article>
            <article className="stat-card">
              <span>Compatibility</span>
              <strong>{report.compatible ? "Pass" : "Fail"}</strong>
            </article>
          </div>

          
          <div className="diff-toggle-row">
            <div>
              <h3>What changed?</h3>
              <p>Inspect the specification differences behind this report.</p>
            </div>

            <button
              type="button"
              className="export-button"
              onClick={() => setShowDiff((current) => !current)}
            >
              {showDiff ? "Hide specification diff" : "View specification diff"}
            </button>
          </div>

          {showDiff && (
            <SpecificationDiff
              oldSpec={comparedOldSpec}
              newSpec={comparedNewSpec}
            />
          )}


          <div className="issues-panel">
            <div className="issues-toolbar">
              <div>
                <h3>Detected changes</h3>
                <p className="results-count">
                  Showing {filteredIssues.length} of {report.issues.length}{" "}
                  findings
                </p>
              </div>

              <div className="filter-controls">
                <input
                  className="search-input"
                  type="search"
                  placeholder="Search endpoints or findings..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  aria-label="Search compatibility findings"
                />

                <select
                  className="category-select"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  aria-label="Filter findings by category"
                >
                  <option value="all">All categories</option>
                  <option value="operation">Operations</option>
                  <option value="parameter">Parameters</option>
                  <option value="response">Responses</option>
                  <option value="request-body">Request bodies</option>
                </select>
              </div>
            </div>

            {report.issues.length === 0 ? (
              <p className="empty-state">
                No breaking changes detected between these contracts.
              </p>
            ) : filteredIssues.length === 0 ? (
              <p className="empty-state">
                No findings match your search or selected category.
              </p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Operation</th>
                      <th>Finding</th>
                      <th>Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssues.map((issue, index) => (
                      <tr key={`${issue.operation}-${index}`}>
                        <td>
                          <span className="category">{issue.category}</span>
                        </td>
                        <td className="operation">{issue.operation}</td>
                        <td>{issue.message}</td>
                        <td>
                          <span className="severity">{issue.severity}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      <footer>
        API Contract Guardian <span>·</span> OpenAPI compatibility analysis
      </footer>
    </main>
  );
}

export default App;
