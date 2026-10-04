# Proposal

## Why

イベント向けの計算機が2箇所に分かれている。ボックス計画は `/events/[id]`、水着2026の料理作成アドバイザーは `/material/result` の素材選択アドバイザー内のタブにある。`/events` はロト（ボックス）型イベント専用で、ボックスを持たないイベント（料理作成の 80614 など）は一覧にも詳細にも出ない。今後ポイント報酬・特攻・優先度表示などイベント機能を増やすため、先に「1イベント = 1ページ、機能はセクションとして差し込む」器を作り、既存の2機能をそこへ集める。データ取り込みの拡張は本 change に含めない。

## What Changes

- `/events/[id]` をイベントページ（ハブ）にする。ヘッダー（名前・会期・状態）の下に、そのイベントで使える機能をセクションとして並べる。
  - ボックス計画セクション: KV `event_data_json` にそのイベントがあるとき表示（既存の計画 UI をそのまま移す）。
  - 料理作成セクション: 静的なイベント機能レジストリに登録されたイベント（現状 80614）で表示。
- 静的なイベント機能レジストリ（イベントID → 使える機能 + 表示用メタ）を追加する。KV に無いイベントでも、レジストリ登録があればページと一覧に出る。
- `/events` 一覧は「KV のボックスイベント ∪ レジストリ登録イベント」を表示し、各イベントに使える機能のバッジを出す。
- 料理作成アドバイザーの need 入力を、`/material/result` の計算結果から**永続ロスター（ChaldeaState＋所持数）由来**に切り替える（ボックス計画と同じ読み取り専用の扱い）。料理計算アルゴリズム・パターン・永続化キーは変えない。
- **BREAKING (UI)**: `/material/result` の素材選択アドバイザーから「水着2026 料理作成」タブを外し、該当イベントページへのリンクを置く。保存済みタブ値 `summer-2026` は `ticket` にフォールバックする。
- 名称を「ボックスイベント／ロトイベント一覧」から「イベント／イベント一覧」に一般化する（ナビ・一覧ヘッダー・ダッシュボードの導線ラベル）。
- ダッシュボードの開催中イベントカードは、ボックスイベントに限らず「イベントページに機能が1つ以上あるイベント」に `/events/[id]` への導線を出す。

## Non-goals

- ボックス以外のイベントデータ（ポイント報酬・ミッション・特攻）の取り込み。
- 手持ちから見た優先度スコア（周回効率 > AP効率）の算出と表示。次の change で扱う。
- 料理作成アルゴリズム・ボックス計画の計算ロジックの変更。
- 料理作成の要件を `material-selection-advisor` から `event-planner` へ移すこと（文面の付け替えのみで挙動差が無いため後回し）。

## Capabilities

### New Capabilities

なし

### Modified Capabilities

- `event-planner`: 「ロト計画 UI」をイベントハブ（一覧・詳細・導線・名称）に置き換え、機能レジストリとセクション表示の要件を追加する。
- `material-selection-advisor`: 「アドバイザーのタブ切り替え」から料理作成タブを外し、料理作成アドバイザーをイベントページで永続ロスター由来の need で動かす要件に変える。

## Impact

- ルート: `app/events/page.tsx`, `app/events/[id]/page.tsx`
- コンポーネント: `components/events/*`（`EventPlannerClient` をボックス計画セクション化、ハブ・一覧の改修）, `components/material/material-selection-advisor.tsx`, `components/material/event-craft-advisor.tsx`（need の受け取り口）, `components/dashboard/EventSection.tsx`, `components/common/nav.tsx`
- ライブラリ・データ: 新規 `data/event-features.ts`（レジストリ）, `lib/get-events.ts`（一覧の合成）, `lib/event-plan.ts`（`computeShortfall` から総必要数の算出を切り出して再利用）
- i18n: `locales/ja.json`, `locales/en.json`（名称変更・セクション見出し・リンク文言）
- テスト: 一覧合成・レジストリ・タブのフォールバック・EventSection の導線条件
- KV / D1 / GitHub Actions の変更なし。
