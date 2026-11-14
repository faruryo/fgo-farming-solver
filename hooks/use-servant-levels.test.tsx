// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'
import { useServantLevels } from './use-servant-levels'

const KEY = STORAGE_KEYS.SERVANT_LEVELS

describe('useServantLevels', () => {
  const onSync = vi.fn()
  beforeEach(() => {
    localStorage.clear()
    onSync.mockClear()
    window.addEventListener('ls-sync', onSync)
  })
  afterEach(() => {
    window.removeEventListener('ls-sync', onSync)
  })

  it('開いただけでは保存値を作らない', async () => {
    const { result } = renderHook(() => useServantLevels())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    await new Promise(r => setTimeout(r, 0))
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(result.current.levels).toEqual({})
    expect(onSync).not.toHaveBeenCalled()
  })

  it('初めての取り込みも未同期の編集になる: 保存値の無い状態からの最初の書き込みでキーを指定した通知が出る', async () => {
    const { result } = renderHook(() => useServantLevels())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    act(() => result.current.importLevels([{ id: 100100, lv: 90, npLv: 2 }]))
    await waitFor(() => expect(localStorage.getItem(KEY)).toBe('{"100100":{"lv":90,"npLv":2}}'))
    expect(onSync).toHaveBeenCalledWith(expect.objectContaining({ detail: { key: KEY } }))
    expect(result.current.levels).toEqual({ 100100: { lv: 90, npLv: 2 } })
  })

  it('知らない欄を持つ保存値で確定する: 知らない欄と知らないサーヴァントの項目が同じ値で残る', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ 100100: { lv: 90, future: { a: [1, 2] } }, 999999: { lv: 'x', other: 'keep' } }),
    )
    const { result } = renderHook(() => useServantLevels())
    await waitFor(() => expect(result.current.levels).toEqual({ 100100: { lv: 90 } }))
    act(() => result.current.importLevels([{ id: 100100, lv: 100 }]))
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual({
        100100: { lv: 100, future: { a: [1, 2] } },
        999999: { lv: 'x', other: 'keep' },
      }),
    )
  })

  it('別の場所の書き込みの通知で読み直す', async () => {
    const { result } = renderHook(() => useServantLevels())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    act(() => {
      localStorage.setItem(KEY, '{"1":{"lv":80}}')
      window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: KEY } }))
    })
    await waitFor(() => expect(result.current.levels).toEqual({ 1: { lv: 80 } }))
  })
})
