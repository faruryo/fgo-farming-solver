import { CardRegion } from './types'

/**
 * 「カードらしい」ピクセルの判定。カードは白〜ベージュ系の背景に加え、下部の
 * 「所持〈数量〉」欄は紺色の帯になっている。一方ページ全体の背景は強く彩度の
 * 高い青グラデーションである。実測（実スクリーンショットのピクセルサンプリング）
 * では、ページ背景・カード行間の隙間は B-R が 100 以上、カードの白背景・紺色の
 * 帯はいずれも B-R が 64 以下と明確に分離できた。当初 R・G の下限値のみで判定
 * していたところ、紺色の帯（R・Gが150を下回る）を非カードと誤判定し、所持数欄が
 * 切り捨てられる不具合があったため、B-R の閾値のみによる判定に変更した。
 * 固定解像度・固定座標に依存しない、色ベースの閾値判定。
 */
const CARDISH_MAX_B_MINUS_R = 80
const isCardish = (r: number, g: number, b: number): boolean =>
  b - r <= CARDISH_MAX_B_MINUS_R

const ROW_DENSITY_THRESHOLD = 0.25
const COL_DENSITY_THRESHOLD = 0.25
/**
 * バンド間の隙間を結合する幅。実スクリーンショットでの実測では、暗い色の
 * アイコン（虚影の塵・宵哭きの鉄杭 等）がカード内で約9pxの局所的な低密度
 * ディップを作り、閾値ベースの投影だけでは1枚のカードを2つに誤分割することが
 * あった。カード間の実際の隙間（実測30px超）とは十分な差があるため、
 * 20pxまでを同一カード内のノイズとして吸収する。
 */
const CLOSE_GAP_PX = 20
/** 検出したバンドがカードとみなせる最小サイズ（ノイズ除去） */
const MIN_BAND_SIZE_PX = 40
/**
 * 先頭/末尾バンドが、内側バンドの標準的なサイズよりこの比率未満しかない場合、
 * スクリーンショットの境界で見切れたカードとみなす（画像端に厳密に接して
 * いなくても、キャプチャの余白等で1px以上のマージンが残ることがあるため）。
 */
const CLIPPED_SIZE_RATIO = 0.85

type Band = { start: number; end: number }

const findDenseBands = (
  density: number[],
  threshold: number,
  minSize: number,
  closeGap: number
): Band[] => {
  const bands: Band[] = []
  let start = -1
  for (let i = 0; i < density.length; i++) {
    const dense = density[i] >= threshold
    if (dense && start === -1) {
      start = i
    } else if (!dense && start !== -1) {
      bands.push({ start, end: i })
      start = -1
    }
  }
  if (start !== -1) bands.push({ start, end: density.length })

  // 小さな隙間で分断されたバンドを結合する
  const merged: Band[] = []
  for (const band of bands) {
    const prev = merged[merged.length - 1]
    if (prev && band.start - prev.end <= closeGap) {
      prev.end = band.end
    } else {
      merged.push({ ...band })
    }
  }

  return merged.filter((b) => b.end - b.start >= minSize)
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * 先頭/末尾バンドが画像端で見切れているかを判定する。
 * ピクセル境界への厳密な接触に加え、内側バンドの標準サイズと比べて
 * 明らかに小さい場合も見切れとみなす（design.md「画像端で見切れたカードの扱い」）。
 */
const isEdgeBandClipped = (
  bands: Band[],
  index: number,
  totalSize: number
): boolean => {
  const band = bands[index]
  if (band.start <= 0 || band.end >= totalSize) return true
  if (bands.length < 3) return false

  const interiorSizes = bands
    .filter((_, i) => i !== 0 && i !== bands.length - 1)
    .map((b) => b.end - b.start)
  if (interiorSizes.length === 0) return false
  const typicalSize = median(interiorSizes)
  const bandSize = band.end - band.start
  return bandSize < typicalSize * CLIPPED_SIZE_RATIO
}

/**
 * 所持アイテム一覧スクリーンショット1枚から、カード単位の領域を動的に検出する。
 * 行方向のプロジェクションでカードの「行」を検出し、各行内で列方向の
 * プロジェクションによりカードごとの列範囲を検出する（design.md Decision 4）。
 */
export const detectCardRegions = (imageData: ImageData): CardRegion[] => {
  const { data, width, height } = imageData
  const cardish = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      cardish[y * width + x] = isCardish(data[idx], data[idx + 1], data[idx + 2]) ? 1 : 0
    }
  }

  const rowDensity = new Array(height).fill(0)
  for (let y = 0; y < height; y++) {
    let sum = 0
    for (let x = 0; x < width; x++) sum += cardish[y * width + x]
    rowDensity[y] = sum / width
  }

  const rowBands = findDenseBands(rowDensity, ROW_DENSITY_THRESHOLD, MIN_BAND_SIZE_PX, CLOSE_GAP_PX)

  const regions: CardRegion[] = []
  rowBands.forEach((rowBand, rowIndex) => {
    const rowClipped =
      (rowIndex === 0 || rowIndex === rowBands.length - 1) &&
      isEdgeBandClipped(rowBands, rowIndex, height)

    const colDensity = new Array(width).fill(0)
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let y = rowBand.start; y < rowBand.end; y++) sum += cardish[y * width + x]
      colDensity[x] = sum / (rowBand.end - rowBand.start)
    }
    const colBands = findDenseBands(colDensity, COL_DENSITY_THRESHOLD, MIN_BAND_SIZE_PX, CLOSE_GAP_PX)
    for (const colBand of colBands) {
      regions.push({
        x: colBand.start,
        y: rowBand.start,
        width: colBand.end - colBand.start,
        height: rowBand.end - rowBand.start,
        clipped: rowClipped,
      })
    }
  })

  return regions
}
