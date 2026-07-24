/**
 * ppu-paddle-ocr（PP-OCRv6 統合多言語モデル）のブラウザ内OCRラッパー。
 * 動的 import で読み込み、`/material` の初回バンドルには含まれない
 * （design.md Decision 5, tasks.md 3.10）。
 */
import { OcrLine } from './types'

let servicePromise: Promise<import('ppu-paddle-ocr/web').PaddleOcrService> | null = null

const getService = async () => {
  if (!servicePromise) {
    servicePromise = (async () => {
      const [{ PaddleOcrService }, ort] = await Promise.all([
        import('ppu-paddle-ocr/web'),
        import('onnxruntime-web'),
      ])
      // crossOriginIsolated でなくても numThreads=1 にフォールバックして動作継続する
      // （design.md Decision 5）。COEPは導入しない前提のため明示的に指定はしない。
      // 実行プロバイダはライブラリ既定（WebGPUが使えればWebGPU、なければWASM）に委ねる。
      void ort
      const service = new PaddleOcrService()
      await service.initialize()
      return service
    })()
  }
  return servicePromise
}

export const recognizeCard = async (
  canvas: HTMLCanvasElement | OffscreenCanvas
): Promise<OcrLine[]> => {
  const service = await getService()
  const result = await service.recognize(canvas as unknown as HTMLCanvasElement, {
    noCache: true,
  })
  return result.lines.flatMap((line) =>
    line.map((box) => ({ text: box.text, confidence: box.confidence }))
  )
}
