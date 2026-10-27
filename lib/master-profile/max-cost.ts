/**
 * lib/master-profile/max-cost.ts
 *
 * マスターレベル → 編成コスト上限テーブル（ML1〜200）。
 *
 * 出典: Atlas Academy `export/JP/NiceUserLevel.json` の `maxCost` を変化点に圧縮したもの。
 * マスターレベルの上限が上がったときは max-ap.ts と一緒に更新する。
 */

import { MAX_MASTER_LEVEL } from './max-ap'

/**
 * 編成コスト上限の変化点。`[level, maxCost]` は「その level 以降、次の変化点の手前まで maxCost」。
 * Lv1〜89 は2レベルごと、Lv89〜101 は3レベルごとに +1、以降は間隔が広がる。
 */
const MAX_COST_BREAKPOINTS: readonly (readonly [level: number, maxCost: number])[] = [
  [1, 56], [3, 57], [5, 58], [7, 59], [9, 60], [11, 61], [13, 62], [15, 63], [17, 64], [19, 65],
  [21, 66], [23, 67], [25, 68], [27, 69], [29, 70], [31, 71], [33, 72], [35, 73], [37, 74], [39, 75],
  [41, 76], [43, 77], [45, 78], [47, 79], [49, 80], [51, 81], [53, 82], [55, 83], [57, 84], [59, 85],
  [61, 86], [63, 87], [65, 88], [67, 89], [69, 90], [71, 91], [73, 92], [75, 93], [77, 94], [79, 95],
  [81, 96], [83, 97], [85, 98], [87, 99], [89, 100], [92, 101], [95, 102], [98, 103], [101, 104],
  [104, 105], [107, 106], [111, 107], [115, 108], [119, 109], [123, 110], [127, 111], [140, 112],
  [150, 113], [160, 114], [170, 115], [180, 116], [190, 117], [200, 118],
]

const buildMaxCostTable = (): number[] => {
  const table = new Array<number>(MAX_MASTER_LEVEL + 1).fill(0)
  MAX_COST_BREAKPOINTS.forEach(([level, maxCost], i) => {
    const next = MAX_COST_BREAKPOINTS.at(i + 1)
    const endLevel = next ? next[0] - 1 : MAX_MASTER_LEVEL
    table.fill(maxCost, level, endLevel + 1)
  })
  return table
}

const MAX_COST_TABLE = buildMaxCostTable()

/**
 * マスターレベルから編成コストの上限を返す。
 *
 * @param level 1〜MAX_MASTER_LEVEL。範囲外は maxApForLevel と同じくクランプする
 *   （未設定時の既定は呼び出し側で MAX_MASTER_LEVEL を渡す想定）。
 */
export const maxCostForLevel = (level: number): number => {
  const clamped = Math.max(1, Math.min(MAX_MASTER_LEVEL, Math.floor(level)))
  return MAX_COST_TABLE.at(clamped) ?? 0
}
