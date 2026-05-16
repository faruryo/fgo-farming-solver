## Context

サーヴァント詳細ページ（`components/servants/servant.tsx`）の STARS ブロックは `{servant.rarity}` を直接レンダリングしており数値が表示されていた。また複数ページ（サーヴァント一覧・マテリアル・ダッシュボード）で独自の星表示が混在し、記号も `✦`（4点）と `★`（5点）が混在していた。

## Goals / Non-Goals

**Goals:**
- 全ページのサーヴァントレアリティ表示を共通コンポーネント `ServantStars` に統一する
- FGO ゲーム内の星に近いビジュアル（5角星・グラデーション・細い縁線・重なり）を実現する
- rarity 0 のサーヴァントでレイアウトが崩れないようにする

**Non-Goals:**
- マテリアルページのレアリティフィルターボタン（`★`.repeat）の変更
- 色・サイズ以外のアニメーション追加

## Decisions

**実装方式: SVG インライン星**
- `text-shadow` による文字アウトラインは星の先端でカバー漏れが生じるため SVG に切り替え
- SVG `stroke` で完全なアウトラインを保証
- `width="1em" height="1em"` で親要素の font-size に自動追従

**星の形状: 外径 10 / 内径 4.6**
- FGO ゲーム内の星に近い角度感（やや鋭め）

**グラデーション: 上から下へ 3 段階**
- 上: `#e8c040`（明るいゴールド）→ 中: `#c09030`（`--gold2`）→ 下: `#8a6018`（ダーク）
- サイトパレットに合わせつつゲーム内の金色に近づける

**縁線: `rgba(38,18,0,0.7)` / strokeWidth 0.8**
- ダークブラウン半透明で細め

**重なり: `marginLeft: '-0.5em'` / z-index 昇順**
- 右の星が左の星に重なる（FGO スタイル）

**rarity 0: 空レンダリング**
- `Array.from({ length: 0 })` で何もレンダリングしない
- `c-stat-num` に `min-height: 1em` を追加してレイアウト高さを維持

**共通化範囲**
- `servants/servant.tsx`（詳細ページ）
- `servants/index.tsx`（一覧グループヘッダー）
- `dashboard/RecentServantSection.tsx`（ダッシュボード）
- `material/servant-card.tsx`（マテリアルカード）

**STARS/CLASS 段差修正**
- `.c-stats { align-items: flex-end }` に変更してラベル底辺を揃える

## Risks / Trade-offs

- SVG グラデーション ID (`servant-star-grad`) がドキュメントスコープで重複する → 全インスタンスで同一内容のため実質問題なし
- font-size 継承で小サイズ（9px）では縁線が視覚的に消える → 許容（ポートレートカードは小サイズ前提）
