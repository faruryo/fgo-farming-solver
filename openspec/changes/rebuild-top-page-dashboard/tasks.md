# Implementation Tasks

## Phase 1: Data Integration & Backend
- [ ] `lib/master-data/update.ts` に Atlas API (`nice_event`, `nice_gacha`) の取得ロジックを追加
- [ ] `updater-worker/index.ts` で新しく追加したメタデータを KV に保存するように修正
- [ ] クライアントサイドでダッシュボード用メタデータを取得するカスタムフック `useDashboardMeta` の作成

## Phase 2: Design System & Infrastructure
- [ ] `globals.css` に Glassmorphism 用のユーティリティクラスを追加
- [ ] `globals.css` に FGO 風の装飾的な枠線、発光アニメーションを実装
- [ ] `recharts` のインストールと基本カラーチャートの設定

## Phase 3: Dashboard Components
- [ ] `components/dashboard/EventSection.tsx`: イベントバナー、カウントダウン、ドロップアイコン
- [ ] `components/dashboard/GachaSection.tsx`: ガチャバナー、PUサーヴァント、終了期限
- [ ] `components/dashboard/ProgressSection.tsx`: Recharts による育成達成率グラフ
- [ ] `components/dashboard/RecommendedQuest.tsx`: 不足素材に基づいた推奨クエ表示

## Phase 4: Page Rebuild & Wizard Form
- [ ] `app/page.tsx` の全面刷新: 上記コンポーネントの配置
- [ ] 素材計算フォームを `components/wizard-form/` に分割・段階的開示化
- [ ] Framer Motion による画面遷移アニメーションの実装

## Phase 5: Polish & UX
- [ ] モバイル向け Sticky Footer (クイックアクション) の実装
- [ ] 達成時の演出 (Achievement Animation) の追加
- [ ] 全画面のレスポンシブ対応とアクセシビリティチェック
