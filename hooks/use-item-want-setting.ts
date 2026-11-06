'use client'

import { useCallback, useMemo } from 'react'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'
import { readUnwantedKeys, withItemWant, type ItemWantRecord } from '../lib/item-want-setting'
import { recordOrEmpty, useLocalStorage } from './use-local-storage'

const NO_WANT: ItemWantRecord = {}

/**
 * 品目ごとの「欲しい／いらない」の設定を端末から読み書きする。交換所とアイテム一覧で同じ保存値を使う。
 * 開いただけでは書かず、書き込みは前の値に重ねる関数形で行う（マウント時の読み込みと競合して値が消えないように）。
 */
export const useItemWantSetting = () => {
  const [stored, setStored, loaded] = useLocalStorage<ItemWantRecord>(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS, NO_WANT, {
    lazyWrite: true,
    onGet: recordOrEmpty,
  })
  const unwanted = useMemo(() => readUnwantedKeys(stored), [stored])
  const setWanted = useCallback(
    (key: string, wanted: boolean) => setStored(prev => withItemWant(prev, key, wanted)),
    [setStored],
  )
  return { unwanted, setWanted, loaded }
}
