## Context

Cloudflare Workers 無料プランのサブリクエスト上限は 50回/invocation。現在の updater-worker は `fetchAndTransformData` (3 base + 40 wave) と `fetchDashboardMeta` (3) を同一 invocation で実行しており、毎回 46/50 を消費している。

wave データ (enemy 構成) の用途を調査したところ、ソルバー計算には一切使用されておらず、`app/quests/[id]/page.tsx` の UI 表示にのみ使用されていることが判明した。このページは `'use client'` コンポーネントであり、クライアントサイドから直接 Atlas Academy API へのフェッチが可能。

## Goals / Non-Goals

**Goals:**
- updater-worker のサブリクエストを 46/50 から 6/50 に削減する
- quest 詳細ページで全クエストの wave データを表示できるようにする（現在は最大 40 件のみ）
- updater の wave fetch コードを削除してシンプル化する

**Non-Goals:**
- wave データのサーバーサイドキャッシュ（Atlas Academy は公開 API で十分高速）
- wave データのオフライン対応
- updater 以外のサブリクエスト削減

## Decisions

### D1: wave fetch をクライアントサイドのオンデマンド取得に移行

**選択**: updater での wave 事前取得を廃止し、クエスト詳細ページで `useQuestWave(aaQuestId)` フックが Atlas Academy から直接フェッチする。

**理由**: wave データはソルバー計算に不要であり、UI 表示のみに使われる。ユーザーが詳細ページを開いた時点でフェッチすれば、updater の 40 サブリクエストを完全に削除できる。

**代替案 A: KV キャッシュ** → updater での取得は維持したまま KV にキャッシュ → 設計が複雑、初期投入スクリプトが必要、最終的にフェッチ回数は変わらない。

**代替案 B: 上位 44 件のみフェッチ** → 毎回同じ重要クエストのみ取得 → 残り 163 件は永遠に wave データなし。

### D2: `aaQuestId` を Quest データに保持する

**選択**: 現在 wave 取得後に `delete q._aaQuestId` していた処理を廃止し、`aaQuestId?: number` として KV に保存する Quest データに含める。

**理由**: クライアントサイドフェッチには Atlas Academy の quest ID が必要。これを Quest 型に持たせることで、別途マッピングテーブルは不要になる。

**代替案**: 別途 `aaQuestId` マッピングを KV に持つ → データの重複と管理コストが増える。

### D3: `waves` を Quest 型から削除する

**選択**: `interfaces/api.ts` と `lib/master-data/types.ts` の Quest 型から `waves?: Wave[]` を削除する。

**理由**: wave データは KV に保存しないため、型から除去してデータ構造をシンプル化する。`useQuestWave` フックが独自の型を持つ。

### D4: `useQuestWave` フックはシンプルな fetch + loading state のみ

**選択**: SWR や React Query を使わず、`useState` + `useEffect` で実装する。

**理由**: 新しい依存ライブラリを追加しない。wave データはページ滞在中に変わらず、ブラウザの HTTP キャッシュ (Cache-Control) が自然にキャッシュする。

## Risks / Trade-offs

- **[Atlas Academy 依存]** ユーザーがクエスト詳細を開いた時に Atlas Academy が落ちていると wave データが表示されない → 既存の "Enemy data not available" フォールバック UI がすでにあるため許容範囲内。
- **[初回表示の遅延]** フェッチが完了するまでローディング表示になる → ローディング中は既存のスピナーやスケルトンを表示する。
- **[`interfaces/api.ts` の Quest 型変更]** `waves` 削除と `aaQuestId` 追加はフロントエンド全体の Quest 型に影響する → `waves` を参照しているのは `app/quests/[id]/page.tsx` のみであるため影響範囲は限定的。

## Migration Plan

1. `lib/master-data/update.ts` から wave fetch ブロックを削除し、`aaQuestId` を保持するよう変更
2. 型定義を更新 (`waves` 削除、`aaQuestId` 追加)
3. `hooks/use-quest-wave.ts` を新規作成
4. `app/quests/[id]/page.tsx` を `useQuestWave` を使う形に変更
5. `pnpm test` + `pnpm run type-check` で検証
6. ロールバック: wave fetch 削除前のコードに戻すだけ。KV の `all_drops_json` は `aaQuestId` が増えるだけで後方互換性あり。

## Open Questions

なし。
