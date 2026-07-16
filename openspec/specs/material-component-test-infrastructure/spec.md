# 仕様書: Materialコンポーネントテスト基盤 (Material Component Test Infrastructure)

## Purpose
`components/material/` の React コンポーネントを jsdom 環境で単体テスト可能にする。既存の純関数テスト（lib/scripts/hooks）の実行環境（Node）とパフォーマンスを維持したまま、コンポーネントテストのみが DOM 環境へオプトインできることを保証する。

## Requirements

### Requirement: Material component test environment

The project MUST support React material component tests in a jsdom environment while retaining the Node environment as the default for existing DOM-free tests.

#### Scenario: Component test opts into jsdom

- **WHEN** a material component test declares the jsdom Vitest environment
- **THEN** the test can render React components, use jest-dom matchers, and simulate user interactions

#### Scenario: Existing non-component test uses the default environment

- **WHEN** an existing test does not declare a DOM environment
- **THEN** Vitest runs it in the default Node environment
