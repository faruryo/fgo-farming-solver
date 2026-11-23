/**
 * 「サーヴァント強化」の選択画面の読み取りの定数。iPhone（2796×1290）の実物の画面で測った値。
 * 長さは見出し「強化するサーヴァントを選択してください」の枠の高さを 1 とした倍数で持つ。
 */

/** 見出しの見分け（1つの枠の文字から空白と記号を除いたものがこれを含む） */
export const ROSTER_HEADING_TEXT = '強化するサーヴァントを選択'

/**
 * 「サーヴァントスキル強化」の選択画面の見出し「スキルを強化するサーヴァントを選択してください」の見分けと換算。
 * 格子・所持数・並びの位置は「サーヴァント強化」の画面と同じで、見出しだけが小さく上にずれる。
 * 見出しの枠を「サーヴァント強化」の見出しの枠（高さ 57・上端 48）に換算してから同じ寸法を使う（左端は同じ）。
 * 物差しは見出しの1行目と2行目「強化には各種素材アイテムが必要です」の上端の間隔（実物で 48）。
 * 1行目の枠の高さは文字認識で 39〜44 とぶれるので、2行目が読めないときだけ使う（実物で 44）。
 */
export const SKILL_HEADING = {
  text: 'スキルを強化するサーヴァントを選択',
  secondLineText: '強化には各種素材',
  /** 換算した枠の高さ（行の間隔の倍数） */
  unitPerLineGap: 57 / 48,
  /** 換算した枠の上端（1行目の上端から下へ、行の間隔の倍数） */
  downPerLineGap: 13 / 48,
  /** 2行目が読めないときの、1行目の枠の高さの倍数 */
  unitPerHeight: 57 / 44,
  downPerHeight: 13 / 44,
} as const

/**
 * 「6列の表示」と「5列の表示」（カードが大きい表示）。どちらの画面でも、7列の表示を、いちばん左の列の顔の左端と
 * 格子の上の端を軸に、この倍率で広げた配置。読み取らず、見分けて案内するためだけに使う。
 * 倍率は実物の画像（2796×1290）で、両画面とも顔の当たる位置がいちばん多かった値。
 */
export const WIDE_COLUMN_LAYOUTS = [
  { columns: 6, scale: 1.17 },
  { columns: 5, scale: 1.41 },
] as const

/** スキルLv の範囲 */
export const SKILL_LV_RANGE = { min: 1, max: 10 } as const

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
  /** スキル強化の画面の、スキルLv「数字/数字/数字」の帯（顔の左上から 右へ・下へ、幅・高さ）。Lv の帯より上にある */
  skillBand: { right: 0.95, down: 2.35, width: 2.5, height: 0.62 },
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
 * - skillCellRows: スキル強化の画面で cellRows の代わりに比べる段（上から 4〜7 番目）
 * - search: 段と列で決めた位置のまわりで位置と一辺を振る幅（顔の一辺の割合。5% 刻みで 27 通り）
 * - rowScanStep: 段の位置を探すときに顔の正方形を縦にずらす刻み（顔の一辺の割合）
 * - maxDiff: 一番近いサーヴァントの差がこれを超えれば「どのサーヴァントにも近くない」
 * - maxRatio: 一番近い差 ÷ 次に近い別のサーヴァントの差がこれを超えれば「顔の差が小さい」
 */
export const FACE_MATCH = {
  size: 16,
  cellRows: { from: 3, to: 10 },
  /** スキル強化の画面で比べる段。顔の中ほどに「強化可能」「スキル Lv.MAX」が重なるので、その上（目のあたり）だけ */
  skillCellRows: { from: 3, to: 6 },
  cellColumns: { from: 3, to: 15 },
  search: { horizontal: 0.05, vertical: 0.05, side: 0.05 },
  rowScanStep: 0.02,
  maxDiff: 10,
  maxRatio: 0.5,
  /** 暗く塗られたカード（スキルLv.MAX）の比べ直しで、候補が切り出しの何倍以上明るければ比べるか */
  darkenedMinGain: 1.2,
  /** 比べ直す候補の明るさの上限（切り出しの何倍まで）。サンプルの Lv.MAX のカードは 1.6〜2.6 倍 */
  darkenedMaxGain: 3,
  /** 「要確認」のカードに添える近いサーヴァントの数 */
  reviewCandidates: 5,
} as const

/** 確かめの画面に出すカードの切り抜きの幅（画素。高さは縦横の比を保つ） */
export const CARD_CROP_WIDTH = 120

/** 文字の帯を文字認識にかける前の拡大率 */
export const BAND_SCALE = 2
