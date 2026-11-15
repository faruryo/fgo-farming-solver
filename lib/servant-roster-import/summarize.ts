/**
 * すべての画像の読みから、検査をして確かめの画面の行にまとめる純粋関数。
 * 並びの項目か向きを読めなかった画像は、値はまとめに入れ、並び順の検査と枚数の検査には入れない。
 */

import type { ServantLevels } from '../servant-levels'
import {
  checkReadingValues,
  checkSortOrder,
  compareOwnedCount,
  countCards,
  keyValueOf,
  readingKey,
  stitchImages,
  withSortChecks,
  type ReadingCheck,
} from './checks'
import { mergeRoster } from './merge'
import type { ImageReading, RosterRow, SortKey, SortOrder } from './types'

export type RosterSummary = {
  rows: RosterRow[]
  /** 並びの項目か向きを読めなかった画像の数 */
  unsortedImageCount: number
  /** 読めたカードの数が所持数より少ないときだけの知らせ */
  shortfall: { owned: number; read: number } | null
}

type SortGroup = { key: SortKey; order: SortOrder; images: ImageReading[] }

/** 並びの項目と向きが同じ画像の集まり（初めに出た順） */
const sortGroups = (images: readonly ImageReading[]): SortGroup[] => {
  const groups = new Map<string, SortGroup>()
  for (const image of images) {
    const { sortKey: key, sortOrder: order } = image
    if (key === null || order === null) continue
    const id = `${key}:${order}`
    const group = groups.get(id)
    if (group) group.images.push(image)
    else groups.set(id, { key, order, images: [image] })
  }
  return [...groups.values()]
}

export const summarizeRoster = (
  images: readonly ImageReading[],
  ctx: { rarityOf: (servantId: number) => number | undefined; stored: ServantLevels },
): RosterSummary => {
  const readings = images.flatMap((image) => image.rows.flat())
  const valueChecks = new Map<string, ReadingCheck>(
    readings.map((r) => [readingKey(r), checkReadingValues(r, ctx.rarityOf)]),
  )
  let checks = valueChecks
  let readCount = 0
  const groups = sortGroups(images)
  for (const { key, order, images: groupImages } of groups) {
    const rows = stitchImages(groupImages, keyValueOf(key, valueChecks), order)
    checks = withSortChecks(checks, checkSortOrder(rows, key, order, valueChecks), key)
    readCount = Math.max(readCount, countCards(rows))
  }
  const sortedOwned = groups.flatMap((g) => g.images.map((image) => image.ownedCount))
  return {
    rows: mergeRoster(readings, checks, ctx.stored),
    unsortedImageCount: images.filter((image) => image.sortKey === null || image.sortOrder === null).length,
    shortfall: compareOwnedCount(sortedOwned, readCount),
  }
}
