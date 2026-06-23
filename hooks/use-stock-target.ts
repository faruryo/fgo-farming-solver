import { useMemo } from 'react'
import { useLocalStorage } from './use-local-storage'
import {
  DEFAULT_SURPLUS_THRESHOLD,
  resolveStockBuffer,
  StockBuffer,
  SurplusThreshold,
} from '../lib/quest-efficiency'

/**
 * 余剰ストック目標(`stockEnabled` + カテゴリ群×レアの `stockBuffer`)を localStorage から
 * 読み出し、旧 `surplusThreshold` からの移行込みで解決する単一ソース。
 *
 * クエスト効率・周回ソルバー取り込み・配布アドバイザー・所持数モーダルが同じ実効目標
 * (`effectiveDeficiency`)を共有するため、その入力(解決済み `stockBuffer`)もここに集約する
 * (D3)。キー名・デフォルト・移行ルールの変更が1箇所で済む。
 */
export const useStockTarget = () => {
  const [stockEnabled, setStockEnabled] = useLocalStorage<boolean>('efficiency/stockEnabled', false)
  const [rawStockBuffer, setRawStockBuffer] = useLocalStorage<Partial<StockBuffer>>(
    'efficiency/stockBuffer',
    {},
  )
  // 旧キー。新規には書き込まないが、ストック目標未設定ユーザーの移行元として読み続ける。
  const [surplusThreshold] = useLocalStorage<SurplusThreshold>(
    'efficiency/surplusThreshold',
    DEFAULT_SURPLUS_THRESHOLD,
  )
  const stockBuffer = useMemo(
    () =>
      resolveStockBuffer(
        // localStorage に "null" 等が入っていても落ちないようガード(空/未設定は移行元 fallback へ)。
        rawStockBuffer && Object.keys(rawStockBuffer).length > 0 ? rawStockBuffer : null,
        surplusThreshold,
      ),
    [rawStockBuffer, surplusThreshold],
  )
  return { stockEnabled, setStockEnabled, rawStockBuffer, setRawStockBuffer, stockBuffer }
}
