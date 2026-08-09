import { screen } from '@testing-library/react'
import { vi } from 'vitest'

/** `components/farming/index.tsx`・`components/material/result.tsx` 共通の送信ボタン取得。 */
export const submitButton = () =>
  screen.findByRole('button', { name: /周回数を求める/ })

/** `fetchMock`の呼び出し履歴から`/api/solve`へのリクエストURLを取り出す。 */
export const solveCallUrl = (fetchMock: ReturnType<typeof vi.fn>): URL => {
  const call = fetchMock.mock.calls.find(
    ([url]) => typeof url === 'string' && url.startsWith('/api/solve')
  )
  if (!call) throw new Error('no /api/solve call recorded')
  return new URL(call[0] as string, 'http://localhost')
}

/** 成功レスポンス(`{ id: 'solve-1' }`)を返す`fetch`のモックを差し込む。 */
export const stubFetch = () => {
  const fetchMock = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ id: 'solve-1' }),
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
