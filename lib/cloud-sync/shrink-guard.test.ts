import { describe, it, expect } from 'vitest'
import {
  MISSING_KEYS_THRESHOLD,
  PayloadScale,
  SHRINK_MIN_DELTA,
  SHRINK_RATIO,
  findMissingKeys,
  isDestructiveShrink,
  measurePayload,
} from './shrink-guard'

// --- フィクスチャ生成 ---------------------------------------------------

type MaterialNode = { disabled?: boolean } | null

// material の JSON。active は有効な育成目標、disabled は除外対象、all は
// 全体設定用の特殊キー、nullNodes は値が null の壊れたエントリ。
const material = ({
  active = 0,
  disabled = 0,
  all = false,
  nullNodes = 0,
  activeWithoutDisabledField = 0,
}: {
  active?: number
  disabled?: number
  all?: boolean
  nullNodes?: number
  activeWithoutDisabledField?: number
} = {}): string => {
  const entries: Record<string, MaterialNode> = {}
  if (all) entries['all'] = { disabled: false }
  for (let i = 0; i < active; i++) entries[`a${i}`] = { disabled: false }
  for (let i = 0; i < activeWithoutDisabledField; i++) entries[`u${i}`] = {}
  for (let i = 0; i < disabled; i++) entries[`d${i}`] = { disabled: true }
  for (let i = 0; i < nullNodes; i++) entries[`n${i}`] = null
  return JSON.stringify(entries)
}

// posession の JSON。count 種類を each 個ずつ持たせる。
const posession = (count: number, each = 30): string => {
  const entries: Record<string, number> = {}
  for (let i = 0; i < count; i++) entries[`i${i}`] = each
  return JSON.stringify(entries)
}

const scale = (servants: number, possessions: number): PayloadScale => ({
  servants,
  possessions,
})

// 事故そのもの: クラウドは 465件中461有効・所持104種、ローカルは material の
// 462件すべてが disabled:true で posession が空。
const ACCIDENT_CLOUD = {
  material: material({ active: 461, disabled: 3, all: true }),
  posession: posession(104),
}
const ACCIDENT_LOCAL = {
  material: material({ disabled: 462 }),
  posession: '{}',
}

describe('measurePayload', () => {
  it('465件中461件が有効な material を servants: 461 と数える', () => {
    expect(measurePayload(ACCIDENT_CLOUD)).toEqual({
      servants: 461,
      possessions: 104,
    })
  })

  it("特殊キー 'all' は育成目標として数えない", () => {
    expect(
      measurePayload({ material: material({ active: 3, all: true }) })
        ?.servants,
    ).toBe(3)
  })

  it('disabled: true は除外し、disabled 未定義は有効として数える', () => {
    expect(
      measurePayload({
        material: material({
          active: 2,
          activeWithoutDisabledField: 3,
          disabled: 5,
        }),
      })?.servants,
    ).toBe(5)
  })

  it('値が null のエントリは stats-logic と同じく数えない', () => {
    expect(
      measurePayload({ material: material({ active: 4, nullNodes: 2 }) })
        ?.servants,
    ).toBe(4)
  })

  it('posession の 0 / null / 負値を除外して possessions: 104 と数える', () => {
    const entries: Record<string, number | null> = JSON.parse(posession(104))
    entries['zero'] = 0
    entries['nullish'] = null
    entries['negative'] = -5
    expect(
      measurePayload({ posession: JSON.stringify(entries) })?.possessions,
    ).toBe(104)
  })

  it('material キーが無いときは null ではなく servants: 0 とする', () => {
    expect(measurePayload({ posession: posession(3) })).toEqual({
      servants: 0,
      possessions: 3,
    })
  })

  it('material が不正 JSON なら測定不能として null を返す', () => {
    expect(
      measurePayload({ material: '{broken', posession: posession(3) }),
    ).toBeNull()
  })

  it('posession が不正 JSON なら測定不能として null を返す', () => {
    expect(
      measurePayload({ material: material({ active: 3 }), posession: 'null}' }),
    ).toBeNull()
  })

  it('両キーとも無いときは 0 件として測定できる(測定不能ではない)', () => {
    expect(measurePayload({})).toEqual({ servants: 0, possessions: 0 })
  })

  // 測定不能(null)は保存を中止させる。パースできた値は、たとえ想定外の形でも
  // 0 件として測定し、中止経路には入れない。
  it('オブジェクトでない有効な JSON はパース失敗ではなく 0 件として扱う', () => {
    expect(measurePayload({ material: 'null', posession: '[]' })).toEqual({
      servants: 0,
      possessions: 0,
    })
  })
})

describe('findMissingKeys', () => {
  const KEYS = ['material', 'posession', 'todoState', 'quests'] as const

  it('keys に含まれないキーがクラウドにだけ存在しても無視する', () => {
    expect(
      findMissingKeys(
        { material: '{}' },
        { material: '{}', legacy: '1' },
        KEYS,
      ),
    ).toEqual([])
  })

  it('クラウドにあり保存内容に無いキーを列挙する', () => {
    expect(
      findMissingKeys(
        { material: '{}' },
        { material: '{}', todoState: '{}', quests: '[]' },
        KEYS,
      ),
    ).toEqual(['todoState', 'quests'])
  })

  it('保存内容に空文字で存在するキーは欠落として扱わない', () => {
    expect(
      findMissingKeys({ todoState: '' }, { todoState: '{"a":1}' }, KEYS),
    ).toEqual([])
  })
})

describe('isDestructiveShrink — 発火する', () => {
  it('事故再現: 461/104 のクラウドに対し全 disabled + 空 posession を保存しようとすると発火する', () => {
    const cloud = measurePayload(ACCIDENT_CLOUD)
    const next = measurePayload(ACCIDENT_LOCAL)
    expect(cloud).toEqual({ servants: 461, possessions: 104 })
    expect(next).toEqual({ servants: 0, possessions: 0 })
    expect(isDestructiveShrink(next!, cloud!, [])).toBe(true)
  })

  it('事故再現: possessions を同数に揃えても servants 単独で発火する', () => {
    const cloud = measurePayload(ACCIDENT_CLOUD)!
    const next = measurePayload(ACCIDENT_LOCAL)!
    expect(
      isDestructiveShrink(
        { ...next, possessions: cloud.possessions },
        cloud,
        [],
      ),
    ).toBe(true)
  })

  it('事故再現: servants を同数に揃えても possessions 単独で発火する', () => {
    const cloud = measurePayload(ACCIDENT_CLOUD)!
    const next = measurePayload(ACCIDENT_LOCAL)!
    expect(
      isDestructiveShrink({ ...next, servants: cloud.servants }, cloud, []),
    ).toBe(true)
  })

  it('育成目標だけが 461→0 になった場合(所持数は同数)でも発火する', () => {
    expect(isDestructiveShrink(scale(0, 104), scale(461, 104), [])).toBe(true)
  })

  it('所持数だけが 104→0 になった場合(育成目標は同数)でも発火する', () => {
    expect(isDestructiveShrink(scale(461, 0), scale(461, 104), [])).toBe(true)
  })

  it('育成目標が 461→200 に減ると発火する', () => {
    expect(isDestructiveShrink(scale(200, 104), scale(461, 104), [])).toBe(true)
  })

  it('境界のちょうど内側: 461→230(461 * 0.5 の切り捨て)で発火する', () => {
    const boundary = Math.floor(461 * SHRINK_RATIO) // 230
    expect(isDestructiveShrink(scale(boundary, 104), scale(461, 104), [])).toBe(
      true,
    )
  })

  it('小規模でも C=10, N=0 なら発火する(絶対件数の下限ちょうど)', () => {
    expect(
      isDestructiveShrink(scale(0, 0), scale(SHRINK_MIN_DELTA, 0), []),
    ).toBe(true)
  })

  it('件数に変化がなくても欠落キーが2件あれば発火する(todoState と quests の消失)', () => {
    expect(
      isDestructiveShrink(scale(461, 104), scale(461, 104), [
        'todoState',
        'quests',
      ]),
    ).toBe(true)
  })
})

describe('isDestructiveShrink — 発火しない(意図的に検知しない)', () => {
  it('育成目標を数体外しただけ(461→458)は日常操作なので検知しない', () => {
    expect(isDestructiveShrink(scale(458, 104), scale(461, 104), [])).toBe(
      false,
    )
  })

  it('素材を数種類使い切っただけ(104→95)は日常操作なので検知しない', () => {
    expect(isDestructiveShrink(scale(461, 95), scale(461, 104), [])).toBe(false)
  })

  it('境界のちょうど外側: 461→231 は半分を超えて残るので検知しない', () => {
    const boundary = Math.floor(461 * SHRINK_RATIO) + 1 // 231
    expect(isDestructiveShrink(scale(boundary, 104), scale(461, 104), [])).toBe(
      false,
    )
  })

  it('半分以上残っている 104→80 は検知しない', () => {
    expect(isDestructiveShrink(scale(461, 80), scale(461, 104), [])).toBe(false)
  })

  it('新規アカウントの初回保存(0→300)は増加なので検知しない', () => {
    expect(isDestructiveShrink(scale(300, 300), scale(0, 0), [])).toBe(false)
  })

  it('両側とも空(0→0)は失うものが無いので検知しない', () => {
    expect(isDestructiveShrink(scale(0, 0), scale(0, 0), [])).toBe(false)
  })

  it('C=9, N=0 の小規模ユーザーは保護対象外として検知しない', () => {
    expect(
      isDestructiveShrink(scale(0, 0), scale(SHRINK_MIN_DELTA - 1, 0), []),
    ).toBe(false)
  })

  it('欠落キー1件(migrateLocalInput による input 削除相当)は正規経路なので検知しない', () => {
    expect(
      isDestructiveShrink(scale(461, 104), scale(461, 104), ['input']),
    ).toBe(false)
    expect(MISSING_KEYS_THRESHOLD).toBe(2)
  })

  it('複数種類あわせて300個消費し種類数が 104→100 に減っても検知しない', () => {
    const cloud = measurePayload({ posession: posession(104, 30) })!
    // 4種類を使い切り(120個)、6種類を1個まで減らし(174個)、1種類から6個消費
    const spent: Record<string, number> = JSON.parse(posession(104, 30))
    for (let i = 0; i < 4; i++) spent[`i${i}`] = 0
    for (let i = 4; i < 10; i++) spent[`i${i}`] = 1
    spent['i10'] = 24
    const next = measurePayload({ posession: JSON.stringify(spent) })!
    const total = (o: Record<string, number>) =>
      Object.values(o).reduce((a, b) => a + b, 0)
    expect(total(JSON.parse(posession(104, 30))) - total(spent)).toBe(300)
    expect([cloud.possessions, next.possessions]).toEqual([104, 100])
    expect(isDestructiveShrink(next, cloud, [])).toBe(false)
  })

  it('素材の個数だけが激減し種類数が不変(104→104)なら検知しない', () => {
    const cloud = measurePayload({ posession: posession(104, 30) })!
    const next = measurePayload({ posession: posession(104, 1) })!
    expect([cloud.possessions, next.possessions]).toEqual([104, 104])
    expect(isDestructiveShrink(next, cloud, [])).toBe(false)
  })

  it('46%の減少(461→250)は半分の閾値を割らないので検知しない', () => {
    expect(isDestructiveShrink(scale(250, 104), scale(461, 104), [])).toBe(
      false,
    )
  })

  it('段階的な減少(461→400→340→290→250)は各ステップが個別には検知されない', () => {
    const steps = [461, 400, 340, 290, 250]
    steps.slice(1).forEach((next, i) => {
      const cloud = steps[i]
      expect(isDestructiveShrink(scale(next, 104), scale(cloud, 104), [])).toBe(
        false,
      )
    })
  })
})
