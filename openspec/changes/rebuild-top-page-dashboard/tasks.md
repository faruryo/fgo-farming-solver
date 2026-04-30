# Implementation Tasks

## Phase 1: Data Integration & Backend
- [x] `lib/master-data/update.ts` に Atlas API (`nice_event`, `nice_gacha`) の取得ロジックを追加
- [x] `updater-worker/index.ts` で新しく追加したメタデータを KV に保存するように修正
- [x] `updater-worker/wrangler.toml` の Cron Trigger を毎時実行 (`0 * * * *`) に変更
- [x] クライアントサイドでダッシュボード用メタデータを取得するカスタムフック `useDashboardMeta` の作成

## Phase 2: Design System & Infrastructure
- [x] `globals.css` に Glassmorphism 用のユーティリティクラスを追加
- [x] `globals.css` に FGO 風の装飾的な枠線、発光アニメーションを実装
- [x] `recharts` のインストールと基本カラーチャートの設定

## Phase 3: Dashboard Components
- [x] `components/dashboard/FarmingWizard.tsx` の実装 (ステップ式誘導フォーム)
- [x] `components/dashboard/EventSection.tsx` の実装 (バナー・残り時間・ドロップ)
- [x] `components/dashboard/GachaSection.tsx` の実装 (召喚バナー・PUサーヴァント)
- [x] `components/dashboard/ProgressSection.tsx` の実装 (Recharts による円グラフ表示)
- [x] `components/dashboard/RecommendedQuest.tsx` の実装 (不足素材に基づく推奨クエスト)

## Phase 4: Integration & Polish
- [x] `app/page.tsx` を全面的に刷新し、ダッシュボードレイアウトを適用
- [x] `next.config.js` に `initOpenNextCloudflareForDev` を追加 (ローカルKV対応)
- [x] 各コンポーネントの Framer Motion によるフェードインアニメーションの調整
- [x] `i18n` 名前空間の整理と翻訳キーの修正
- [x] エッジケース（データ未取得時、画像404時）のフォールバック実装
- [x] モバイル向け Sticky Footer (クイックアクション) の実装
- [x] 達成時の演出 (Achievement Animation) の追加
- [x] 全画面のレスポンシブ対応とアクセシビリティチェック
