# Design: Dashboard & UI/UX Rebuild

## Visual Design System

### Color Palette (70:25:5 Rule)
- **Base (70%)**: `--navy` (#0a1622) - 宇宙の暗淵をイメージした深いネイビー。
- **Primary (25%)**: `--panel` (rgba(16, 28, 44, 0.8)) - Glassmorphism を適用した半透明パネル。
- **Accent (5%)**: `--gold` (#d4af37) / `--prismatic` (虹色グラデーション) - ボタン、強調テキスト、重要アイコン。

### Aesthetics
- **Glassmorphism**: パネルに `backdrop-filter: blur(10px)` と薄い白の境界線を適用し、高級感を演出。
- **FGO UI Elements**: 
    - 金色の装飾的なボーダー (`gold-shine` アニメーション)。
    - レア素材ドロップ時の「虹色の煌めき」を再現した CSS グラデーション。
    - サーヴァントの顔アイコン（`face`）を囲む円形フレーム。

## Information Architecture

### Dashboard Layout (Top-to-Bottom)
1. **Global Header**: QP, 聖晶石(想定), クラウド同期状況。
2. **Event Banner (Hero)**: 開催中イベントを横幅いっぱいに表示。右端に「あと何日」のカウントダウン。
3. **Personal Progress (Middle Left)**: ドーナツチャートによる育成達成率。
4. **Active Gacha (Middle Right)**: ガチャバナーとPUサーヴァントのミニスライダー。
5. **Recommended Quests (Bottom)**: 縦スクロールのカード型リスト。ドロップ品アイコンを並列。

## Technical Architecture

### Data Integration
- **`updater-worker` の拡張**: 
    - Atlas Academy API から `nice_event.json` と `nice_gacha.json` をフェッチ。
    - 必要なデータ（name, banner, openedAt, closedAt, shopFinishedAt, pickupServants, quests/drops）だけを抽出し、KVストアの `dashboard_meta` に保存。
- **クライアントサイド**: 
    - `SWR` または `React Query` で `dashboard_meta` を取得。
    - 現在時刻と比較して表示/非表示を動的に制御。

### Component Architecture
- `components/dashboard/EventCard`: バナー、期間、ドロップ表示。
- `components/dashboard/GachaSlider`: ガチャ一覧。
- `components/dashboard/ProgressChart`: Recharts を使用した進捗可視化。
- `components/dashboard/MaterialTo-Do`: 足りない素材と推奨クエスト。

## Interactions & Animations
- **Progressive Disclosure**: フォームの「次へ」ボタンでパネルが横滑りするように遷移（Framer Motion）。
- **Celebration Effect**: 全素材が揃った際、画面全体に「召喚成功時」のようなパーティクルエフェクトを表示。
- **Haptic Feedback**: モバイル操作時、ボタンクリックに連動した微細なバイブレーション（Web Vitals/API想定）。
