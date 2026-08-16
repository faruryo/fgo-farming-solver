import type { CloudMetadata } from './decision'

export type CloudData = {
  storage: Record<string, string>
  metadata: CloudMetadata
}

/**
 * パース失敗のみ null。キーが無い・空文字・JSON の null は「空の記録」として {} に倒す。
 * 測定不能(null)は保存を中止させるため、失敗の定義は広げない。
 */
export const parseRecord = (
  raw: string | null | undefined,
): Record<string, unknown> | null => {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return {}
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * /api/cloud のレスポンスを CloudData 形式に正規化する。
 * 旧形式（metadata / storage が分離されていない raw storage）の場合は epoch タイムスタンプでラップする。
 */
export const normalizeCloudResponse = (
  rawData: unknown,
): CloudData => {
  if (
    rawData &&
    typeof rawData === 'object' &&
    'metadata' in rawData &&
    'storage' in rawData &&
    (rawData as { metadata: unknown }).metadata &&
    (rawData as { storage: unknown }).storage
  ) {
    return rawData as unknown as CloudData
  }

  return {
    storage: (rawData && typeof rawData === 'object' ? rawData : {}) as unknown as Record<string, string>,
    metadata: { updatedAt: new Date(0).toISOString(), deviceId: 'unknown' },
  }
}
