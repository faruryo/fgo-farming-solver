/** 「サーヴァント強化」の選択画面のスクリーンショットからの取り込みの共有型 */

export type { OcrBox } from '../possession-import/types'
export type { Rect } from '../shop-screenshot-import/types'
import type { Rect } from '../shop-screenshot-import/types'

/** 照合用の顔のアイコンの1枚（配る形。16×16 の RGBA を base64 にしたもの） */
export type FaceIconEntry = { servantId: number; url: string; pixels: string }

/** 照合用のデータ（配る形）。`icons` 以外の欄は作る処理の記録で、読む側は使わない */
export type FaceIconData = {
  icons: FaceIconEntry[]
  /** 前回取得できなかったアイコンの URL（次の実行で取り直す） */
  failedUrls?: string[]
  /** `nice_servant` の前回の応答の ETag（条件付きの取得の目印） */
  etag?: string | null
  updatedAt?: string
}

/** 照合の候補の1枚（縮めた画素。比べない升目は透明にしてある） */
export type FaceCandidate = { servantId: number; pixels: Uint8ClampedArray }

/** 読んだ選択画面（enhance: サーヴァント強化、skill: サーヴァントスキル強化） */
export type RosterScreen = 'enhance' | 'skill'

/** 見出しの枠から決めた格子の横の位置と大きさ */
export type RosterGrid = {
  screen: RosterScreen
  /** 見出しの枠（スキル強化の画面ではサーヴァント強化の見出しの枠に換算したもの） */
  heading: Rect
  /** 長さの単位（見出しの枠の高さ） */
  unit: number
  /** 顔の正方形の一辺 */
  side: number
  /** 7つの列の顔の正方形の左端 */
  columnXs: number[]
}

/** カードの顔の照合の結果 */
export type FaceMatch =
  | { kind: 'matched'; servantId: number; best: number; second: number; rect: Rect }
  /** ambiguous: 一番近いサーヴァントと次に近い別のサーヴァントの比が大きい。unknown: 一番近い差が上限を超える */
  | { kind: 'review'; reason: 'ambiguous-face' | 'unknown-face'; nearest: number[]; best: number; rect: Rect }

/** 「今の値/上限」の読み */
export type ValueRead = { current: number; max: number }

/** 値の範囲で値を決めなかった読み */
export type ValueFailure = { kind: 'lv' | 'npLv'; current: number; max: number }

/** 1つのカードの文字の帯の読み（上と下の帯を合わせたもの） */
export type CardValues = {
  lv: ValueRead | null
  npLv: ValueRead | null
  /** スキル強化の画面のカードの下の「数字/数字/数字」（スキル1〜3の Lv）。読めないか範囲の外なら null */
  skills: SkillLevels | null
  failures: ValueFailure[]
}

/** スキル1〜3の Lv */
export type SkillLevels = [number, number, number]

/** 1枚の画像の1枚のカードの読み */
export type CardReading = {
  imageIndex: number
  /** 読んだ選択画面（skill のカードは Lv を読まない） */
  screen: RosterScreen
  /** 画像の中の段の順（上から 0） */
  row: number
  /** 列（左から 0〜6） */
  column: number
  face: FaceMatch
  values: CardValues
  /** 確かめの画面に出す切り抜き（data URL など。無ければ null） */
  crop: string | null
}

export type SortKey = 'npLv' | 'lv'
export type SortOrder = 'desc' | 'asc'

/** 1枚の画像の読み */
export type ImageReading = {
  imageIndex: number
  name: string
  /** 読んだ選択画面（skill の画像は Lv を読まず、スキルLv を読む） */
  screen: RosterScreen
  /** 所持数（「所持サーヴァント: N/M」の N）。読めなければ null */
  ownedCount: number | null
  sortKey: SortKey | null
  sortOrder: SortOrder | null
  /** 上から順の段。段ごとに、カードとして取り出した位置だけを左から（捨てた位置は含まない） */
  rows: CardReading[][]
}

/** 「要確認」の理由 */
export type ReviewReason =
  | 'ambiguous-face'
  | 'unknown-face'
  | 'out-of-range'
  | 'rarity-mismatch'
  | 'sort-order'
  | 'lower-than-saved'

/** 育成計算機のスキルの今の値（サーヴァントの ID → スキル1〜3） */
export type StoredSkills = Readonly<Record<string, readonly number[]>>

/** 推定した値の範囲（片側だけのこともある） */
export type ValueRange = { min?: number; max?: number }

/** 確かめの画面の1行（サーヴァントごとに1つ。顔が「要確認」のカードは1枚ごとに1つ） */
export type RosterRow = {
  key: string
  /** 当てたサーヴァント。顔が「要確認」なら null */
  servantId: number | null
  /** 取り込む値。「要確認」で空にした欄と、読めなかった種類は null */
  lv: number | null
  npLv: number | null
  /**
   * スキル強化の画面から読んだスキル1〜3の Lv。読めなかった行は null。
   * 育成計算機のスキルの今の値より低かったスキルの欄は、利用者が決めるまで空（null）にする
   */
  skills: (number | null)[] | null
  /** 「要確認」でなければ null */
  review: {
    reasons: ReviewReason[]
    /** 検査に通らなかったか保存値より低かったので空にした欄（利用者が決めるまで取り込まない） */
    undecided: ('lv' | 'npLv')[]
    /** 顔が「要確認」のときの近いサーヴァント（近い順） */
    servantCandidates: number[]
    lvCandidates: number[]
    npLvCandidates: number[]
    lvRange: ValueRange | null
    npLvRange: ValueRange | null
    /** 育成計算機のスキルの今の値より低いので空にしたスキルの欄（0 始まり。利用者が決めるまで取り込まない） */
    undecidedSkills: number[]
    /** スキルごとの候補（空にしたスキルだけ、読んだ値と今の値） */
    skillCandidates: number[][]
  } | null
  crop: string | null
}

/** 進み具合 */
export type RosterProgress = { phase: 'icons' } | { phase: 'image'; current: number; total: number }

/** 読み取りの結果 */
export type RosterImportResult =
  | { kind: 'icons-unavailable' }
  | {
      kind: 'done'
      /** 読んだ画像の数（読めなかった画像を含む） */
      imageCount: number
      /** 読めなかった画像の名前 */
      unreadableImages: string[]
      /** スキル強化の画面の5列の表示の画像の名前（読み取らない） */
      fiveColumnImages: string[]
      /** 並びの項目か向きを読めなかった画像の数 */
      unsortedImageCount: number
      /** 撮り漏れの知らせ（読めたカードの数が所持数より少ないときだけ） */
      shortfall: { owned: number; read: number } | null
      rows: RosterRow[]
    }
