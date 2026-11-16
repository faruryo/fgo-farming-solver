'use client'

import { useCallback, useMemo } from 'react'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'
import {
  readServantLevels,
  withServantLevel,
  withServantLevels,
  type ServantLevelEdit,
  type ServantLevelImportRow,
} from '../lib/servant-levels'
import { recordOrEmpty, useLocalStorage } from './use-local-storage'

const EMPTY: Record<string, unknown> = {}

/**
 * 所持サーヴァントの Lv・宝具Lv の保存値を読み書きする。取り込みの確定と一覧の表示が同じ hook を使う。
 * 開いただけでは書かない（取り込みの無い端末が空の保存値を同期に載せないため）。hook は保存値の生の表を持ち、
 * 範囲の外の値を落とす読み方は返す値を作るときにだけ当てる（書き戻すときに知らない欄を落とさないため）。
 */
export const useServantLevels = () => {
  const [stored, setStored, loaded] = useLocalStorage<Record<string, unknown>>(STORAGE_KEYS.SERVANT_LEVELS, EMPTY, {
    lazyWrite: true,
    onGet: recordOrEmpty,
  })
  const levels = useMemo(() => readServantLevels(stored), [stored])
  const importLevels = useCallback(
    (rows: readonly ServantLevelImportRow[]) => setStored(prev => withServantLevels(prev, rows)),
    [setStored],
  )
  /** 1騎の Lv・宝具Lv を欄のとおりに置き換える（`null` の欄は消す）。値が変わらないかの判定は呼ぶ側で行う */
  const setServantLevel = useCallback(
    (id: string | number, edit: ServantLevelEdit) => setStored(prev => withServantLevel(prev, id, edit)),
    [setStored],
  )
  return { levels, importLevels, setServantLevel, loaded }
}
