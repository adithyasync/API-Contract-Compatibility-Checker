# API Contract Guardian 🛡️

**Detect breaking API changes before they reach production.**

API Contract Guardian is a full-stack developer tool that compares two OpenAPI specifications and identifies potential breaking changes between API versions. It helps developers understand how contract changes may affect existing API consumers before releasing an update.

🔗 **Live Demo:** https://api-contract-compatibility-checker-1.onrender.com/

📦 **GitHub Repository:** https://github.com/adithyasync/API-Contract-Compatibility-Checker

---

## 📌 The Problem

APIs evolve over time. Developers may remove endpoints, change request parameters, introduce required fields, or modify response structures.

These changes can unintentionally break applications that depend on the existing API contract.

Detecting such changes manually can be time-consuming and error-prone.

## 💡 The Solution

API Contract Guardian compares an older OpenAPI specification with a newer version and generates a compatibility report highlighting detected breaking changes.

Instead of manually inspecting two lengthy API specifications, developers can use the tool to identify potential compatibility issues and review the relevant changes.

## ✨ Features

- **Multiple input modes:** Compare specifications using the built-in demo, pasted or edited specifications, or uploaded files.
- **OpenAPI validation:** Validate specifications before compatibility analysis.
- **Breaking-change detection:** Identify supported changes involving operations, request parameters, request bodies, and responses.
- **Compatibility report:** View detected issues, their categories, and a summary of the results.
- **Specification diff viewer:** Inspect line-by-line additions and removals between the two specifications.
- **Issue filtering:** Search and filter compatibility issues.
- **Report export:** Download compatibility reports in JSON and Markdown formats.
- **Input safeguards:** Enforce file and pasted-specification size limits and clean up temporary files after processing.
- **Automated checks:** Run backend type-checking, regression tests, and a frontend production build through GitHub Actions.

## 🛠️ Tech Stack

| Area | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express, TypeScript |
| API specification parsing | Swagger Parser |
| YAML processing | YAML |
| File uploads | Multer |
| Testing | Node.js test runner, `tsx` |
| CI/CD | GitHub Actions |
| Deployment | Render |

## 🏗️ Architecture

The application separates the user interface from the compatibility engine.

1. **Input:** The user supplies an old and a new OpenAPI specification.
2. **Validation:** The backend validates both specifications.
3. **Extraction:** The compatibility engine extracts API operations and their relevant contract details.
4. **Comparison:** Supported compatibility rules identify potential breaking changes.
5. **Reporting:** The backend returns a structured compatibility report.
6. **Visualization:** The frontend displays the results and lets users inspect specification differences.

```text
                 React + TypeScript
                         |
             Demo / Paste / Upload
                         |
                  Express API
                         |
                OpenAPI Validation
                         |
                Operation Extraction
                         |
                Compatibility Engine
                         |
              Structured Issue Report
                         |
               Results + Diff Viewer
```

## 📂 Project Structure

```text
API Contract Compatibility/
├── .github/
│   └── workflows/
│       └── ci.yml
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   └── SpecificationDiff.tsx
│   │   └── App.tsx
│   └── package.json
├── server/
│   └── src/
│       ├── compatibility/
│       │   ├── compatibilityChecker.ts
│       │   ├── requestChecker.ts
│       │   ├── requestBodyChecker.ts
│       │   ├── responseChecker.ts
│       │   └── reportTypes.ts
│       └── parser/
│           ├── parser.ts
│           ├── validator.ts
│           └── operationExtractor.ts
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

*The structure above highlights the main project files; individual test files and other supporting files are omitted for readability.*

## 🚀 Getting Started

### Prerequisites

- Node.js and npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/adithyasync/API-Contract-Compatibility-Checker.git
cd API-Contract-Compatibility-Checker
```

### 2. Install backend dependencies

From the project root:

```bash
npm ci
```

### 3. Start the backend

```bash
npm run dev
```

The backend runs locally on port `3000` by default.

Verify that it is running by opening:

```text
http://localhost:3000/api/health
```

### 4. Install frontend dependencies

Open a second terminal:

```bash
cd client
npm ci
```

### 5. Configure the frontend

Create `client/.env.local` with:

```dotenv
VITE_API_BASE_URL=http://localhost:3000
```

This configures the frontend to call the local backend during development.

### 6. Start the frontend

From the `client` directory:

```bash
npm run dev
```

Open the local URL printed by Vite in your terminal.

## 🧪 Testing and Quality Checks

The project uses TypeScript type-checking and regression tests to help verify the compatibility engine.

Run the backend type-check:

```bash
npm run typecheck
```

Build the backend:

```bash
npm run build
```

Run the backend regression tests:

```bash
npx tsx --test server/src/parser/operationExtractor.test.ts server/src/compatibility/requestChecker.test.ts server/src/compatibility/responseChecker.test.ts server/src/compatibility/requestBodyChecker.test.ts server/src/compatibility/requestBodyRef.test.ts server/src/compatibility/responseRef.test.ts
```

Build the frontend:

```bash
cd client
npm ci
npm run build
```

The current regression suite has **37 passing tests across 6 suites**.

## ⚙️ Continuous Integration

GitHub Actions runs automated checks on pushes to `main` and pull requests targeting `main`.

The workflow checks:

- Backend TypeScript types
- Backend regression tests
- Frontend production build

This helps catch common regressions before changes are merged or deployed.

## ☁️ Deployment

The application is deployed using Render:

- **Frontend:** Render Static Site
- **Backend:** Render Web Service

The frontend uses the `VITE_API_BASE_URL` environment variable to communicate with the deployed backend.

Free hosting may have cold starts, so the first request after inactivity can take longer than subsequent requests.

## 🔮 Future Improvements

Potential future enhancements include:

- More comprehensive OpenAPI compatibility rules.
- Improved handling of complex schema composition and references.
- Configurable compatibility policies and severity levels.
- CI integrations that fail a build when breaking changes are detected.
- Detailed reports that identify the exact schema path responsible for each issue.

## 🎯 Project Goal

API Contract Guardian aims to make API evolution safer and more predictable by helping developers identify potential breaking changes before they affect existing consumers.

---

**Built with React, TypeScript, Node.js, and Express.**
