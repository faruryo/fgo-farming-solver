# 仕様書: 育成素材計算機 (Material)

## Purpose
ユーザーが目標とするサーヴァントの育成に必要な素材を計算し、現在の所持数との差分を一覧表示する機能。

## Requirements

### Requirement: ServantCard ポートレートからサーヴァント詳細への遷移
育成素材計算機のサーヴァントカードにおいて、ポートレート（アイコン画像）をクリックするとサーヴァント詳細ページへ遷移できなければならない (SHALL)。

#### Scenario: ポートレートクリックによる詳細ページ遷移
- **WHEN** ServantCard のポートレート（`c-servant-portrait` 領域）をクリックしたとき
- **THEN** `/servants/{servant.id}` へ遷移する。
- **THEN** ポートレート領域のレイアウト（flex センタリング）および hover アニメーションは維持される。
