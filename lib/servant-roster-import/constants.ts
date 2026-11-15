/**
 * 「サーヴァント強化」の選択画面の読み取りの定数。iPhone（2796×1290）の実物の画面で測った値。
 * 長さは見出し「強化するサーヴァントを選択してください」の枠の高さを 1 とした倍数で持つ。
 */

/** 見出しの見分け（1つの枠の文字から空白と記号を除いたものがこれを含む） */
export const ROSTER_HEADING_TEXT = '強化するサーヴァントを選択'

/** 画面の寸法（見出しの枠の高さの倍数） */
export const ROSTER_LAYOUT = {
  /** 列の数 */
  columns: 7,
  /** 顔の正方形の一辺 */
  faceSide: 3.49,
  /** いちばん左の列の顔の左端（見出しの枠の左端から左へ） */
  firstColumnLeft: 3.14,
  /** 列の間隔 */
  columnPitch: 4.19,
  /** 段の間隔 */
  rowPitch: 4.46,
  /** 上の文字の帯（顔の左上から 右へ・下へ、幅・高さ） */
  topBand: { right: 0.53, down: -0.07, width: 3.16, height: 0.84 },
  /** 下の文字の帯（顔の左上から 右へ・下へ、幅・高さ） */
  bottomBand: { right: 0.88, down: 2.77, width: 2.81, height: 0.77 },
  /** 下の文字の帯の下端（顔の上端から下へ） */
  bottomBandBottom: 3.54,
  /** 格子の上の端（見出しの枠の上端から下へ） */
  gridTop: 4.6,
  /** 所持数の矩形（見出しの枠の左上から 右へ・下へ、幅・高さ） */
  ownedCount: { right: -1.19, down: 2.14, width: 7.89, height: 2.11 },
  /** 並びの項目の矩形（同じ） */
  sortKey: { right: 28.28, down: 2.14, width: 6.67, height: 2.11 },
  /** 並びの向きの矩形（同じ） */
  sortOrder: { right: 33.89, down: 1.61, width: 3.33, height: 1.75 },
} as const

/**
 * 顔の照合の定数。
 * - cellRows・cellColumns: 16×16 の升目のうち比べる段と列（0 始まり、両端を含む）。上から 4〜11 番目の段、左から 4〜16 番目の列
 * - search: 段と列で決めた位置のまわりで位置と一辺を振る幅（顔の一辺の割合。5% 刻みで 27 通り）
 * - rowScanStep: 段の位置を探すときに顔の正方形を縦にずらす刻み（顔の一辺の割合）
 * - maxDiff: 一番近いサーヴァントの差がこれを超えれば「どのサーヴァントにも近くない」
 * - maxRatio: 一番近い差 ÷ 次に近い別のサーヴァントの差がこれを超えれば「顔の差が小さい」
 */
export const FACE_MATCH = {
  size: 16,
  cellRows: { from: 3, to: 10 },
  cellColumns: { from: 3, to: 15 },
  search: { horizontal: 0.05, vertical: 0.05, side: 0.05 },
  rowScanStep: 0.02,
  maxDiff: 10,
  maxRatio: 0.5,
  /** 「要確認」のカードに添える近いサーヴァントの数 */
  reviewCandidates: 5,
} as const

/** 確かめの画面に出すカードの切り抜きの幅（画素。高さは縦横の比を保つ） */
export const CARD_CROP_WIDTH = 120

/** 文字の帯を文字認識にかける前の拡大率 */
export const BAND_SCALE = 2
