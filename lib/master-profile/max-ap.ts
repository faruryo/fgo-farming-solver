/**
 * lib/master-profile/max-ap.ts
 *
 * D1: マスターレベル → 最大AP テーブル（ML1〜200）。
 *
 * 出典: Gamerch「マスターレベル別 AP上限」早見表。
 * 検証アンカー: ML170→146, ML180→148, ML200→152。
 *
 * 聖晶石・黄金の果実は「最大AP（全回復）」で扱うため、課金額換算の基準となる
 * 横断プロフィール値。固定換算（旧 金果実=40 / 銀林檎=20）は本テーブルで置換する。
 */

/** 現行のマスターレベル上限（2026 正月で 200 開放）。 */
export const MAX_MASTER_LEVEL = 200

/**
 * 最大AP の変化点。`[level, maxAp]` は「その level 以降、次の変化点の手前まで maxAp」。
 * レベルが上がるごとに 1 ずつ増える区間を圧縮して保持する（メンテ容易・レビュー容易）。
 *
 * 低レベル帯（〜L101）は等差（区間ごとに +offset）。
 * L101 以降は増分が鈍化し、数レベルごとに +1。
 */
const MAX_AP_BREAKPOINTS: readonly (readonly [level: number, maxAp: number])[] = [
  // L1-9: maxAp = level + 19
  [1, 20], [2, 21], [3, 22], [4, 23], [5, 24], [6, 25], [7, 26], [8, 27], [9, 28],
  // L10-14: level + 21
  [10, 31], [11, 32], [12, 33], [13, 34], [14, 35],
  // L15-19: level + 23
  [15, 38], [16, 39], [17, 40], [18, 41], [19, 42],
  // L20-101: level + 25（+1/lv が連続）— 区間始端のみ列挙、内挿で埋める
  [20, 45],
  [101, 126],
  // L101 以降は鈍化（変化点のみ）
  [103, 127], [105, 128], [107, 129], [109, 130], [111, 131], [113, 132],
  [115, 133], [117, 134], [119, 135], [121, 136], [125, 137], [129, 138],
  [133, 139], [137, 140], [143, 141], [147, 142], [153, 143], [157, 144],
  [163, 145], [167, 146], [173, 147], [177, 148], [183, 149], [187, 150],
  [193, 151], [197, 152],
]

/**
 * 変化点配列から ML1..MAX_MASTER_LEVEL の最大AP配列を構築する。
 *
 * L20→L101 のように変化点が離れている区間は「+1/lv の等差」で内挿する
 * （20:45 と 101:126 はちょうど level+25 で連続するため整合）。
 * それ以外の区間（L101 以降）は次の変化点まで値を据え置く。
 */
const buildMaxApTable = (): number[] => {
  const table = new Array<number>(MAX_MASTER_LEVEL + 1).fill(0)
  for (let i = 0; i < MAX_AP_BREAKPOINTS.length; i++) {
    const [level, maxAp] = MAX_AP_BREAKPOINTS[i]
    const next = MAX_AP_BREAKPOINTS[i + 1]
    const endLevel = next ? next[0] - 1 : MAX_MASTER_LEVEL
    // 区間が +1/lv の等差で連続する場合（次の変化点が等差延長線上）は内挿。
    const span = endLevel - level
    const isArithmetic = next != null && next[1] - maxAp === next[0] - level
    for (let lv = level; lv <= endLevel; lv++) {
      table[lv] = isArithmetic ? maxAp + (lv - level) : maxAp
    }
    // 等差でない据え置き区間も span 分は maxAp のまま（上のループで充足済み）
    void span
  }
  return table
}

const MAX_AP_TABLE = buildMaxApTable()

/**
 * マスターレベルから最大AP を返す。
 *
 * @param level 1〜MAX_MASTER_LEVEL。範囲外はクランプする
 *   （未設定時の既定は呼び出し側で MAX_MASTER_LEVEL を渡す想定）。
 */
export const maxApForLevel = (level: number): number => {
  const clamped = Math.max(1, Math.min(MAX_MASTER_LEVEL, Math.floor(level)))
  return MAX_AP_TABLE[clamped]
}

/** 未設定時の既定最大AP（最大レベルの最大AP）。 */
export const DEFAULT_MAX_AP = maxApForLevel(MAX_MASTER_LEVEL)
