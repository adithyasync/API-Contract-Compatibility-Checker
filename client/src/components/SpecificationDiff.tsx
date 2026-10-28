
import { diffLines } from "diff";
import "./SpecificationDiff.css";

type SpecificationDiffProps = {
  oldSpec: string;
  newSpec: string;
};

type DiffRow = {
  oldLine: string;
  newLine: string;
  type: "unchanged" | "removed" | "added";
};

export default function SpecificationDiff({
  oldSpec,
  newSpec,
}: SpecificationDiffProps) {
  const changes = diffLines(oldSpec, newSpec);
  const rows: DiffRow[] = [];

  for (const change of changes) {
    const lines = (change.value ?? "").split("\n");

    // Avoid creating an extra empty row when a chunk ends with a newline.
    if (lines[lines.length - 1] === "") {
      lines.pop();
    }

    for (const line of lines) {
      if (change.added) {
        rows.push({
          oldLine: "",
          newLine: line,
          type: "added",
        });
      } else if (change.removed) {
        rows.push({
          oldLine: line,
          newLine: "",
          type: "removed",
        });
      } else {
        rows.push({
          oldLine: line,
          newLine: line,
          type: "unchanged",
        });
      }
    }
  }

  const oldLineCount = rows.filter(
    (row) => row.type !== "added"
  ).length;

  const newLineCount = rows.filter(
    (row) => row.type !== "removed"
  ).length;

  const removedCount = rows.filter(
    (row) => row.type === "removed"
  ).length;

  const addedCount = rows.filter(
    (row) => row.type === "added"
  ).length;

  return (
    <section className="spec-diff" aria-label="Specification diff">
      <div className="spec-diff-header">
        <div>
          <h3>Specification diff</h3>
          <p>Textual differences between the two contracts.</p>
        </div>

        <div className="diff-summary">
          <span className="diff-added-count">+{addedCount}</span>
          <span className="diff-removed-count">−{removedCount}</span>
        </div>
      </div>

      <div className="diff-legend">
        <span>
          <i className="diff-legend-added" /> Added
        </span>
        <span>
          <i className="diff-legend-removed" /> Removed
        </span>
        <span>
          <i className="diff-legend-unchanged" /> Unchanged
        </span>
      </div>

      <div className="diff-columns">
        <div className="diff-column-heading">
          <strong>Current specification</strong>
          <span>{oldLineCount} lines</span>
        </div>
        <div className="diff-column-heading">
          <strong>Proposed specification</strong>
          <span>{newLineCount} lines</span>
        </div>
      </div>

      <div className="diff-code" role="region" aria-label="Line-by-line differences" tabIndex={0}>
        {rows.length === 0 ? (
          <p className="diff-empty">Both specifications are empty.</p>
        ) : (
          rows.map((row, index) => (
            <div
              className={`diff-row diff-row-${row.type}`}
              key={`${index}-${row.type}`}
            >
              <div className="diff-cell">
                <span className="diff-line-number">
                  {row.type === "added" ? "" : rows
                    .slice(0, index)
                    .filter((previous) => previous.type !== "added").length + 1}
                </span>
                <span className="diff-marker">
                  {row.type === "removed" ? "−" : row.type === "unchanged" ? " " : ""}
                </span>
                <code>{row.oldLine || " "}</code>
              </div>

              <div className="diff-cell">
                <span className="diff-line-number">
                  {row.type === "removed" ? "" : rows
                    .slice(0, index)
                    .filter((previous) => previous.type !== "removed").length + 1}
                </span>
                <span className="diff-marker">
                  {row.type === "added" ? "+" : row.type === "unchanged" ? " " : ""}
                </span>
                <code>{row.newLine || " "}</code>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="diff-disclaimer">
        This view highlights textual changes. Consult the compatibility
        findings below to determine which changes the analyzer identifies
        as breaking.
      </p>
    </section>
  );
}
