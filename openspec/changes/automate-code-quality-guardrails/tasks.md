## 1. Static analysis foundation

- [x] 1.1 Add the verified SonarJS, security, jscpd, and Knip development dependencies with pnpm
- [x] 1.2 Rework ESLint into zero-debt error rules and ratcheted debt rules, include scripts and test-specific overrides, and restore extension-aware Prettier parsing
- [x] 1.3 Move every inline ESLint suppression into reasoned, file-scoped configuration allowlists
- [x] 1.4 Fix the existing violations of the selected zero-debt typed rules
- [x] 1.5 Implement the file-and-rule lint ratchet script and record its initial baseline

## 2. Testability and review guidance

- [x] 2.1 Add progressive-disclosure testing instructions for pure rules, dependency injection, edge-case coverage, and test-failure verification
- [x] 2.2 Add concise repository-specific Code Review Rules to AGENTS.md
- [x] 2.3 Add a pull request template that separates AI-finding classification from human UI and specification checks
- [x] 2.4 Document quality gate operation, baseline reduction, report interpretation, platform rationale, and the external Codex review activation step

## 3. Structural quality reports

- [x] 3.1 Configure and locally run jscpd with machine-readable report output and no build-failing threshold
- [x] 3.2 Configure and locally run Knip with the repository's actual Next.js, script, test, and configuration entry points
- [x] 3.3 Add a report-only GitHub Actions workflow for PR, main, and scheduled structural audits with retained artifacts

## 4. CI and verification

- [x] 4.1 Add the lint ratchet to the existing required Ubuntu CI without changing deployment behavior
- [x] 4.2 Verify lint, lint ratchet, type-check, unit tests, structural audit commands, and workflow syntax
- [x] 4.3 Validate the OpenSpec change strictly and record the final applicable, already-present, non-applicable, and external-only inventory
