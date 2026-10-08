# Proposal

## Why

料理作成は、正の不足がある素材のドロップデータが欠けると配分計算を止める（#119）。止め方は正しいが、画面は「一部が欠けている」としか言わず、止まった事実はユーザーのブラウザにしか残らない。穴が本番のドロップ表にあるのか誤検知なのかを、運営側から確かめられない。

## What Changes

- 計算を止めたとき、欠けた素材の名前と欠け方（ドロップ表に素材が無い / ドロップ行が無い）をエラー文面に出す。
- 同じ欠落を、所持数やユーザー識別子を含めない構造化ログとして Workers Logs に残し、素材IDと欠け方で集計できるようにする。
- 周回対象の素材について、ドロップ表（`all_drops_json`）と Atlas 素材一覧の突き合わせを読み取り専用で一度実行し、表に載っていないものがあれば一覧を残す。定期ジョブにはしない。

## Capabilities

### New Capabilities

なし

### Modified Capabilities

- `material-selection-advisor`: 料理作成がドロップデータ欠落で計算を止めるとき、欠けた素材と欠け方を画面に出し、同じ内容を本番ログから集計できる形で残す要件を追加する。

## Impact

- `lib/event-craft-data-check.ts`（欠落の返し方に欠け方を含める）
- `components/events/EventCraftSection.tsx` と `locales/ja.json` / `locales/en.json`
- 欠落を Workers Logs に出すための小さな API（所持数は受け取らない）
- 読み取り専用の突き合わせスクリプト。Cloudflare cron や KV への書き込みはしない
- 既存の「欠落時は配分計算をしない」境界は維持する。計算式・配分パターンは変えない
