import { describe, it, expect } from 'vitest'
import type { Item as AtlasItem } from '../../interfaces/atlas-academy'
import { toApiItemId } from '../to-api-item-id'
import {
  assignItemId,
  assignQuestIds,
  emptyRegistry,
  questKey,
  registryFromPrevious,
  type IdRegistry,
} from './stable-ids'

type Q = { area: string; name: string; id: string; section: string; aaQuestId?: number }

const quest = (area: string, name: string, section: 'Daily' | 'Free' = 'Free', aaQuestId?: number): Q => ({
  area,
  name,
  id: `${area}_${name}`.replace(/\s/g, '_'),
  section,
  aaQuestId,
})

// update.ts L503-521 の現行位置ベース採番の忠実な再現（パリティ検証用）
const positionalAssign = (quests: Q[]): Map<string, string> => {
  const dailyAreas = [...new Set(quests.filter(q => q.section === 'Daily').map(q => q.area))].sort()
  const freeAreas = [...new Set(quests.filter(q => q.section !== 'Daily').map(q => q.area))].sort()
  const areaPrefix = new Map<string, string>()
  dailyAreas.forEach((area, i) => areaPrefix.set(area, '0' + i.toString(36)))
  freeAreas.forEach((area, i) => {
    areaPrefix.set(area, (Math.floor(i / 36) + 1).toString(36) + (i % 36).toString(36))
  })
  const questIndexInArea = new Map<string, number>()
  const longToShort = new Map<string, string>()
  for (const q of quests) {
    const idx = questIndexInArea.get(q.area) ?? 0
    longToShort.set(q.id, (areaPrefix.get(q.area) ?? '?') + idx.toString(36))
    questIndexInArea.set(q.area, idx + 1)
  }
  return longToShort
}

describe('assignQuestIds', () => {
  it('matches positional assignment exactly with an empty registry (parity)', () => {
    const quests = [
      quest('修練場（月）', '弓極級', 'Daily'),
      quest('修練場（火）', '剣極級', 'Daily'),
      quest('エリアB', 'クエストB1'),
      quest('エリアA', 'クエストA1'),
      quest('エリアA', 'クエストA2'),
      quest('エリアC', 'クエストC1'),
    ]
    const stable = assignQuestIds(quests, emptyRegistry())
    const positional = positionalAssign(quests)
    expect(Object.fromEntries(stable)).toEqual(Object.fromEntries(positional))
  })

  it('keeps existing prefixes when an area is inserted upstream; new area gets an unused prefix', () => {
    const gen1 = [quest('エリアB', 'B1'), quest('エリアD', 'D1')]
    const reg = emptyRegistry()
    const m1 = assignQuestIds(gen1, reg)
    expect(m1.get('エリアB_B1')).toBe('100')
    expect(m1.get('エリアD_D1')).toBe('110')

    // エリアA が上流（ソート順で先頭）に挿入されても既存プレフィックスは不変
    const gen2 = [quest('エリアA', 'A1'), quest('エリアB', 'B1'), quest('エリアD', 'D1')]
    const m2 = assignQuestIds(gen2, reg)
    expect(m2.get('エリアB_B1')).toBe('100')
    expect(m2.get('エリアD_D1')).toBe('110')
    // 新エリアは未使用の最小プレフィックス（'10','11' は使用済み → '12'）
    expect(m2.get('エリアA_A1')).toBe('120')
  })

  it('keeps existing quest IDs when a quest is inserted mid-area; new quest gets max+1', () => {
    const gen1 = [quest('エリアA', 'Q1'), quest('エリアA', 'Q3')]
    const reg = emptyRegistry()
    const m1 = assignQuestIds(gen1, reg)
    expect(m1.get('エリアA_Q1')).toBe('100')
    expect(m1.get('エリアA_Q3')).toBe('101')

    // Q2 が間に挿入されても Q3 のIDは不変、Q2 は max+1
    const gen2 = [quest('エリアA', 'Q1'), quest('エリアA', 'Q2'), quest('エリアA', 'Q3')]
    const m2 = assignQuestIds(gen2, reg)
    expect(m2.get('エリアA_Q1')).toBe('100')
    expect(m2.get('エリアA_Q3')).toBe('101')
    expect(m2.get('エリアA_Q2')).toBe('102')
  })

  it('never reuses the ID of a deleted quest (tombstone survives a 2-generation round trip)', () => {
    const reg = emptyRegistry()
    const m1 = assignQuestIds([quest('エリアA', 'Q1'), quest('エリアA', 'Q2')], reg)
    expect(m1.get('エリアA_Q2')).toBe('101')

    // 世代2: Q2 が削除される（レジストリには墓標が残る）
    const m2 = assignQuestIds([quest('エリアA', 'Q1')], reg)
    expect(m2.get('エリアA_Q1')).toBe('100')

    // 世代3: 新クエスト QX が追加されても '101'（Q2 の墓標）は再利用されない
    const m3 = assignQuestIds([quest('エリアA', 'Q1'), quest('エリアA', 'QX')], reg)
    expect(m3.get('エリアA_QX')).toBe('102')
  })

  it('keeps the ID through a quest rename when aaQuestId matches', () => {
    const reg = emptyRegistry()
    const m1 = assignQuestIds([quest('エリアA', '旧名', 'Free', 94001)], reg)
    expect(m1.get('エリアA_旧名')).toBe('100')

    const m2 = assignQuestIds([quest('エリアA', '新名', 'Free', 94001)], reg)
    expect(m2.get('エリアA_新名')).toBe('100')
    // 新キーが登録され、旧キーも墓標として残る
    expect(reg.quests[questKey('エリアA', '新名')]).toEqual({ id: '100', aa: 94001 })
    expect(reg.quests[questKey('エリアA', '旧名')]).toEqual({ id: '100', aa: 94001 })
  })

  // 回帰: スプレッドシート→Atlas の名前マッチは曖昧で、別クエストに同一 aaQuestId が
  // 振られることがある（実例: アヴァロンのノリッジ/キャメロットが共に aa=3000901）。
  // 旧名クエストが現存するのに aa 一致で新規クエストがそのIDを奪うと重複IDになる。
  it('does not let a new quest steal the ID of a still-existing quest via aaQuestId collision', () => {
    const reg = emptyRegistry()
    const m1 = assignQuestIds([quest('アヴァロン', 'ノリッジ', 'Free', 3000901)], reg)
    expect(m1.get('アヴァロン_ノリッジ')).toBe('100')

    // キャメロット(新規)が同じ aaQuestId を持つが、ノリッジは現存 → aa フォールバック禁止
    const m2 = assignQuestIds(
      [
        quest('アヴァロン', 'ノリッジ', 'Free', 3000901),
        quest('アヴァロン', 'キャメロット', 'Free', 3000901),
      ],
      reg
    )
    expect(m2.get('アヴァロン_ノリッジ')).toBe('100')
    expect(m2.get('アヴァロン_キャメロット')).toBe('101')
    expect(new Set(m2.values()).size).toBe(2)
  })

  it('never assigns the same ID twice within a generation even with a polluted registry', () => {
    // 過去バグ等でレジストリ内に同一IDの別キーが存在しても、今世代の割当は一意になる
    const reg = emptyRegistry()
    reg.areas['アヴァロン'] = '10'
    reg.quests[questKey('アヴァロン', 'ノリッジ')] = { id: '100', aa: 3000901 }
    reg.quests[questKey('アヴァロン', 'キャメロット')] = { id: '100', aa: 3000901 }

    const m = assignQuestIds(
      [
        quest('アヴァロン', 'ノリッジ', 'Free', 3000901),
        quest('アヴァロン', 'キャメロット', 'Free', 3000901),
      ],
      reg
    )
    expect(m.get('アヴァロン_ノリッジ')).toBe('100')
    expect(m.get('アヴァロン_キャメロット')).toBe('101')
  })

  it('assigns a new prefix when an area is renamed (aaQuestId match does not carry the old prefix)', () => {
    const reg = emptyRegistry()
    const m1 = assignQuestIds([quest('旧エリア', 'Q1', 'Free', 94001)], reg)
    expect(m1.get('旧エリア_Q1')).toBe('100')

    // エリア改名: aaQuestId は一致するが、旧プレフィックス '10' を持ち込まず新プレフィックスで採番
    const m2 = assignQuestIds([quest('新エリア', 'Q1', 'Free', 94001)], reg)
    expect(m2.get('新エリア_Q1')).toBe('110')
    // 旧プレフィックス '10' は墓標として予約されたまま（後続の新エリアにも渡らない）
    const m3 = assignQuestIds(
      [quest('新エリア', 'Q1', 'Free', 94001), quest('別エリア', 'Z1')],
      reg
    )
    expect(m3.get('別エリア_Z1')).toBe('120')
  })

  it('always assigns Daily IDs a 0-prefix and refuses section-mismatched prefix reuse', () => {
    const quests = [quest('修練場（月）', '弓極級', 'Daily'), quest('エリアA', 'Q1', 'Free')]
    const reg = emptyRegistry()
    const m1 = assignQuestIds(quests, reg)
    expect(m1.get('修練場（月）_弓極級')).toBe('000')
    expect(m1.get('エリアA_Q1')).toBe('100')

    // エリアA がなぜか Daily に変わった場合、'10' は再利用されず '0?' を新規取得する
    const flipped = [quest('エリアA', 'Q1', 'Daily')]
    const m2 = assignQuestIds(flipped, reg)
    expect(m2.get('エリアA_Q1')![0]).toBe('0')
    expect(m2.get('エリアA_Q1')).toBe('010')
  })

  it('produces 4-char IDs beyond index 35 while keeping the 2-char prefix', () => {
    const reg = emptyRegistry()
    const quests = Array.from({ length: 37 }, (_, i) => quest('エリアA', `Q${i}`))
    const m = assignQuestIds(quests, reg)
    expect(m.get('エリアA_Q35')).toBe('10z')
    expect(m.get('エリアA_Q36')).toBe('1010')
    expect(m.get('エリアA_Q36')!.slice(0, 2)).toBe('10')
    // 4文字IDの墓標も maxIndex に正しく寄与する
    const m2 = assignQuestIds([...quests, quest('エリアA', 'Q37')], reg)
    expect(m2.get('エリアA_Q37')).toBe('1011')
  })
})

describe('registryFromPrevious', () => {
  it('pins all published IDs when the previous payload has no id_registry', () => {
    const previous = {
      quests: [
        { area: '修練場（月）', name: '弓極級', id: '020', section: 'Daily', aaQuestId: 94066101 },
        { area: 'オケアノス', name: '隠された島', id: '1a2', section: 'Free' },
      ],
      items: [
        { id: '00', atlasId: 6503 },
        { id: '6e', atlasId: 6999 },
      ],
    }
    const reg = registryFromPrevious(previous)
    expect(reg.areas['修練場（月）']).toBe('02')
    expect(reg.areas['オケアノス']).toBe('1a')
    expect(reg.quests[questKey('修練場（月）', '弓極級')]).toEqual({ id: '020', aa: 94066101 })
    expect(reg.quests[questKey('オケアノス', '隠された島')]).toEqual({ id: '1a2' })
    expect(reg.items['6503']).toBe('00')
    expect(reg.items['6999']).toBe('6e')

    // ピン留めされたIDがそのまま再利用される
    const m = assignQuestIds(
      [quest('修練場（月）', '弓極級', 'Daily', 94066101), quest('オケアノス', '隠された島')],
      reg
    )
    expect(m.get('修練場（月）_弓極級')).toBe('020')
    expect(m.get('オケアノス_隠された島')).toBe('1a2')
  })

  it('adopts an existing id_registry as a deep clone', () => {
    const prior: IdRegistry = {
      version: 1,
      areas: { エリアA: '10' },
      quests: { [questKey('エリアA', 'Q1')]: { id: '100' } },
      items: { '6503': '00' },
    }
    const reg = registryFromPrevious({ id_registry: prior })
    expect(reg).toEqual(prior)
    reg.quests[questKey('エリアA', 'Q2')] = { id: '101' }
    reg.quests[questKey('エリアA', 'Q1')].aa = 94001
    expect(prior.quests[questKey('エリアA', 'Q1')]).toEqual({ id: '100' })
    expect(Object.keys(prior.quests)).toHaveLength(1)
  })

  it('returns an empty registry for missing previous data', () => {
    expect(registryFromPrevious(undefined)).toEqual(emptyRegistry())
    expect(registryFromPrevious(null)).toEqual(emptyRegistry())
  })
})

describe('assignItemId', () => {
  const item = (id: number, background: string, priority: number): AtlasItem =>
    ({ id, background, priority, name: `item${id}` } as unknown as AtlasItem)

  // 銅素材（priority 200番台 → intercept '0'）の例
  const bronzeA = item(6503, 'bronze', 200)
  const bronzeB = item(6516, 'bronze', 201)
  const all = [bronzeA, bronzeB]

  it('matches toApiItemId exactly with an empty registry (parity)', () => {
    const reg = emptyRegistry()
    expect(assignItemId(bronzeA, all, reg)).toBe(toApiItemId(bronzeA, all))
    expect(assignItemId(bronzeB, all, reg)).toBe(toApiItemId(bronzeB, all))
  })

  it('reuses the registered ID for a known atlasId even after positional shift', () => {
    const reg = emptyRegistry()
    expect(assignItemId(bronzeA, all, reg)).toBe('00')
    expect(assignItemId(bronzeB, all, reg)).toBe('01')

    // 上流挿入で位置がずれても atlasId 一致で同じIDを維持
    const inserted = item(6500, 'bronze', 200)
    const shifted = [inserted, bronzeA, bronzeB]
    expect(assignItemId(bronzeA, shifted, reg)).toBe('00')
    expect(assignItemId(bronzeB, shifted, reg)).toBe('01')
  })

  it('assigns intercept-space max+1 when the positional candidate collides with another atlasId', () => {
    const reg = emptyRegistry()
    assignItemId(bronzeA, all, reg) // '00'
    assignItemId(bronzeB, all, reg) // '01'

    // 新アイテムが positional 先頭（'00'）を主張しても、別 atlasId 割当済みなので max+1
    const inserted = item(6500, 'bronze', 200)
    const shifted = [inserted, bronzeA, bronzeB]
    expect(assignItemId(inserted, shifted, reg)).toBe('02')
    expect(reg.items['6500']).toBe('02')
  })

  it("returns '' for non-target items without touching the registry", () => {
    const reg = emptyRegistry()
    const eventItem = item(94000001, 'zero', 9905)
    expect(assignItemId(eventItem, all, reg)).toBe('')
    expect(reg.items).toEqual({})
  })
})
