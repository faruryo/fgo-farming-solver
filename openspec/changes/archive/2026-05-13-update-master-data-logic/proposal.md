# Proposal: Update Master Data Logic and Solver Optimization

## Problem
The automated master data update process was broken due to an obsolete spreadsheet URL and changes in the source sheet structure. Additionally, the production KV data was incomplete (only containing item ID 1), and there was no mechanism to prioritize the most efficient farming stages, leading to potentially bloated datasets and slower solver performance.

## Solution
1.  **Restore Data Integrity**: Update the spreadsheet source to the active "Domus Aurea" sheet and implement a robust item name mapping logic using standard abbreviations and class-specific patterns.
2.  **Performance Optimization**: Implement a "Top 5 Stages" filter per item to ensure the solver only considers the most efficient locations, reducing data payload and calculation overhead.
3.  **Local Quality Assurance**: Add unit tests using Vitest to verify transformation logic locally without requiring cloud deployment.
4.  **Documentation**: Formalize the solver's Linear Programming algorithm and the master data specifications in Japanese for better maintainability.

## Scope
- `lib/master-data/update.ts`: Core transformation and filtering logic.
- `lib/master-data/update.test.ts`: Unit tests.
- `docs/master_data_spec_jp.md`: Data specification.
- `docs/solver_spec_jp.md`: Algorithm specification.
- `package.json`: Dependency and script updates.

## Non-goals
- Changes to the solver algorithm itself (Linear Programming logic remains unchanged).
- UI/UX modifications to the frontend.
