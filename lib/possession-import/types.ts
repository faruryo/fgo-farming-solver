/** マイルーム所持アイテム一覧スクリーンショットからの取り込み機能の共有型 */

/** 画像内で検出された1枚のカード領域（画像座標系のピクセル矩形） */
export type CardRegion = {
  x: number
  y: number
  width: number
  height: number
  /** 画像の上端または下端に接しており、カード全体が写っていない可能性がある */
  clipped: boolean
}

/** OCRが1カードから読み取ったテキスト行 */
export type OcrLine = {
  text: string
  confidence: number
}

/** 1カードのOCR結果から抽出した候補 */
export type CardCandidate = {
  /** どの投稿画像由来か（0始まりのインデックス） */
  sourceImageIndex: number
  /** 元画像内でのカード領域（クロップ表示用） */
  region: CardRegion
  /** OCRで読み取った生テキスト行 */
  ocrLines: OcrLine[]
  /** ファジーマッチで特定できた場合の Atlas ID */
  atlasId: number | null
  /** ファジーマッチしたアイテム名（表示用） */
  matchedName: string | null
  /** ファジーマッチの一致度（0-1） */
  matchScore: number
  /** 読み取れた所持数（読み取れなかった場合 null） */
  quantity: number | null
  /** 画像端で見切れているカード由来か */
  clipped: boolean
  /** クロップ画像（レビューUIでのオンデマンド表示用） */
  cropDataUrl: string
}

/** 複数画像・複数カードを統合した後の、レビューUIに表示する1件の候補 */
export type MergedCandidate = {
  atlasId: number
  name: string
  /** 現在の posession 値（未所持の場合 0） */
  currentQuantity: number
  /** 統合後の提案値。矛盾がある場合は null（ユーザー選択待ち） */
  proposedQuantity: number | null
  /** このアイテムを構成した元カード候補（矛盾表示・クロップ確認用） */
  sources: CardCandidate[]
  /** 矛盾（複数画像で異なる所持数）があるか */
  hasConflict: boolean
  /** 見切れカードのみに由来し、要確認扱いか */
  needsReview: boolean
  /** ユーザーが除外操作をしたか */
  excluded: boolean
}

export type AnalyzeProgress = {
  imageIndex: number
  imageCount: number
  stage: 'detecting-cards' | 'ocr' | 'matching'
}
