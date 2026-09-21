import { describe, it, expect } from 'vitest'
import extra2Data from '../../data/class-board/extra2.json'
import type { ClassBoardData } from './board-types'
import type { ClassBoardDetailState } from './types'
import {
  computeBoardAllTarget,
  computePrunedOnNone,
  computeRouteUnlocked,
  getBlankSquareIds,
  getPlayableSquareIds,
} from './route-actions'
import { findShortestPathFromStarts } from './find-shortest-path'
import { resolveLineEndpoints } from './line-endpoints'

describe('User Action Scenarios (Extra2 Board)', () => {
  const board = extra2Data as unknown as ClassBoardData
  const playables = getPlayableSquareIds(board)
  const blankIds = getBlankSquareIds(board)
  const lines = board.lines
  const startIds = board.startSquareIds
  const lineEndpoints = resolveLineEndpoints(lines, blankIds)

  it('シナリオ1: 全マス目標設定時、blankノードが混入せず全72実マスが目標になる', () => {
    const state = computeBoardAllTarget(undefined, playables)
    expect(state.unlockedSquareIds).toEqual([])
    expect(state.targetSquareIds).toHaveLength(72)
    // blankマスは一切含まれない
    for (const bId of blankIds) {
      expect(state.targetSquareIds).not.toContain(bId)
    }

    // 全ラインの両端ステータスが target であること
    for (const line of lines) {
      const ep = lineEndpoints.get(line.id)
      expect(state.targetSquareIds).toContain(ep?.endpointA ?? -1)
      expect(state.targetSquareIds).toContain(ep?.endpointB ?? -1)
    }
  })

  it('シナリオ2: ユーザーが 56(Artsクリティカル) を「ルート解放済」にした時、中継点を跨ぐラインが途中で分断されない', () => {
    // 全マス目標状態からスタート
    const initialTargetState = computeBoardAllTarget(undefined, playables)

    // 56への最短経路を取得
    const path = findShortestPathFromStarts(lines, startIds, 56)
    expect(path).toContain(56)

    // ルート解放済を実行（blankマスは除外される）
    const state = computeRouteUnlocked(initialTargetState, path, blankIds)

    // blankマスがステートに混入していないことを検証
    for (const bId of blankIds) {
      expect(state.unlockedSquareIds).not.toContain(bId)
      expect(state.targetSquareIds).not.toContain(bId)
    }

    // 56 は unlocked になっている
    expect(state.unlockedSquareIds).toContain(56)
    // 57 は target のまま残っている
    expect(state.targetSquareIds).toContain(57)

    // 56 と 57 を結ぶライン（line 49: 56->90, line 90: 90->57）の検証
    // どちらのラインも両端が endpointA: 56, endpointB: 57 として完全に解決される！
    const line49Ep = lineEndpoints.get(49)
    const line90Ep = lineEndpoints.get(90)

    expect(line49Ep).toEqual({ endpointA: 56, endpointB: 57 })
    expect(line90Ep).toEqual({ endpointA: 56, endpointB: 57 })

    // したがって、line 49 と line 90 は全く同一のステータス（prev: unlocked, next: target）で描画され、
    // 途中で色が青からオレンジに割れる現象が完全に解消されている！
  })

  it('シナリオ3: 71(ツアーロック)から53(Busterクリティカル)への折れ線（86, 87中継）が青色で統一される', () => {
    const path = findShortestPathFromStarts(lines, startIds, 56)
    const state = computeRouteUnlocked(undefined, path, blankIds)

    // 71 と 53 の間のライン群: line 69(71->86), line 86(86->87), line 87(87->53)
    const ep69 = lineEndpoints.get(69)
    const ep86 = lineEndpoints.get(86)
    const ep87 = lineEndpoints.get(87)

    expect(ep69).toEqual({ endpointA: 71, endpointB: 53 })
    expect(ep86).toEqual({ endpointA: 71, endpointB: 53 })
    expect(ep87).toEqual({ endpointA: 71, endpointB: 53 })

    // 71 と 53 は両方 unlocked なので、全3ラインがすべて unlocked 判定（青）になる！
    expect(state.unlockedSquareIds).toContain(71)
    expect(state.unlockedSquareIds).toContain(53)
  })

  it('シナリオ4: 未開放操作時、枝の途中マスを消すと下流が連鎖未開放になり、末端マスを消すと単独のみ未開放になる', () => {
    // 全マス目標状態
    const state = computeBoardAllTarget(undefined, playables)

    // 枝の途中マス（44: 69 -> 44 -> 45 -> blank -> 46）を未開放にする
    const pruned44 = computePrunedOnNone(state, 44, lines, startIds, blankIds)
    // 44とその下流（45, 46）の3マスが未開放になり、残りは69マス
    expect(pruned44.targetSquareIds).not.toContain(44)
    expect(pruned44.targetSquareIds).not.toContain(45)
    expect(pruned44.targetSquareIds).not.toContain(46)
    expect(pruned44.targetSquareIds).toHaveLength(69)

    // 末端マス（46）を未開放にする
    const pruned46 = computePrunedOnNone(state, 46, lines, startIds, blankIds)
    // 46 だけが未開放になり、71マス残る
    expect(pruned46.targetSquareIds).not.toContain(46)
    expect(pruned46.targetSquareIds).toHaveLength(71)
  })

  it('シナリオ5: 起点2(id: 32)自身を未開放にした場合、起点2からのみ到達可能なマスのみが未開放になり、起点1側のマスは残る', () => {
    const state = computeBoardAllTarget(undefined, playables)

    // 起点 32 を未開放にする
    const pruned = computePrunedOnNone(state, 32, lines, startIds, blankIds)

    // 32 は削除される
    expect(pruned.targetSquareIds).not.toContain(32)
    // 起点1 (id: 1) とその周辺マスは維持される
    expect(pruned.targetSquareIds).toContain(1)
  })

  it('シナリオ6: 起点から孤立したマスを未開放にした場合、対象マスが正常にクリアされる', () => {
    // 孤立した単体マス（例: 56）だけが目標にある状態
    const singleState: ClassBoardDetailState = {
      unlockedSquareIds: [],
      targetSquareIds: [56],
    }

    // 56 を未開放にする
    const pruned = computePrunedOnNone(singleState, 56, lines, startIds, blankIds)
    expect(pruned.unlockedSquareIds).toEqual([])
    expect(pruned.targetSquareIds).toEqual([])
  })
})
