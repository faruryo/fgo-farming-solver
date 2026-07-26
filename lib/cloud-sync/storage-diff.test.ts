import { describe, it, expect } from 'vitest'
import { diffKeys, diffPossessions } from './storage-diff'

const posession = (counts: Record<string, number | null>) => ({
  posession: JSON.stringify(counts),
})

describe('diffPossessions', () => {
  it('orders the entries by how much they shrink, biggest loss first', () => {
    const result = diffPossessions(
      posession({ '6512': 10, '6503': 0, '6999': 40 }),
      posession({ '6512': 20, '6503': 342, '6999': 100 }),
    )

    expect(result?.map((d) => d.id)).toEqual(['6503', '6999', '6512'])
    expect(result?.[0]).toEqual({
      id: '6503',
      localCount: 0,
      cloudCount: 342,
      delta: -342,
    })
  })

  it('leaves out items that grew or stayed the same', () => {
    const result = diffPossessions(
      posession({ up: 30, same: 10, down: 1 }),
      posession({ up: 5, same: 10, down: 9 }),
    )

    expect(result?.map((d) => d.id)).toEqual(['down'])
  })

  it('includes items that exist only in the cloud, counting local as zero', () => {
    const result = diffPossessions(posession({}), posession({ '6503': 342 }))

    expect(result).toEqual([
      { id: '6503', localCount: 0, cloudCount: 342, delta: -342 },
    ])
  })

  // 空の記録(キー欠落・空文字・JSON の null)は {} 扱い。壊れた JSON だけが
  // 「差分を出せない」。0 と偽って「全部消える」と見せてはいけない。
  it('treats an absent or empty side as an empty record, not as a failure', () => {
    expect(diffPossessions({}, posession({ a: 3 }))).toEqual([
      { id: 'a', localCount: 0, cloudCount: 3, delta: -3 },
    ])
    expect(diffPossessions({ posession: '' }, { posession: 'null' })).toEqual([])
  })

  it('returns null when either side cannot be parsed', () => {
    expect(diffPossessions({ posession: '{oops' }, posession({ a: 1 }))).toBeNull()
    expect(diffPossessions(posession({ a: 1 }), { posession: '{oops' })).toBeNull()
  })

  it('ignores non-numeric counts instead of crashing on them', () => {
    const result = diffPossessions(
      { posession: JSON.stringify({ a: null, b: 'x' }) },
      { posession: JSON.stringify({ a: 5, b: 2 }) },
    )

    expect(result).toEqual([
      { id: 'a', localCount: 0, cloudCount: 5, delta: -5 },
      { id: 'b', localCount: 0, cloudCount: 2, delta: -2 },
    ])
  })
})

describe('diffKeys', () => {
  it('classifies missing / shrunk / grown / same / unknown', () => {
    const result = diffKeys(
      {
        shrunk: JSON.stringify({ a: 1 }),
        grown: JSON.stringify({ a: 1, b: 2, c: 3 }),
        same: JSON.stringify({ a: 1 }),
        broken: '{oops',
      },
      {
        missing: JSON.stringify({ a: 1 }),
        shrunk: JSON.stringify({ a: 1, b: 2 }),
        grown: JSON.stringify({ a: 1 }),
        same: JSON.stringify({ a: 1 }),
        broken: JSON.stringify({ a: 1 }),
      },
      ['missing', 'shrunk', 'grown', 'same', 'broken'],
    )

    expect(result.map((d) => d.status)).toEqual([
      'missing',
      'shrunk',
      'grown',
      'same',
      'unknown',
    ])
    expect(result[1]).toEqual({
      key: 'shrunk',
      localSize: 1,
      cloudSize: 2,
      status: 'shrunk',
    })
    expect(result[4].localSize).toBeNull()
  })

  it('counts objects by key, arrays by length, primitives as one, absent as zero', () => {
    const result = diffKeys(
      {
        object: JSON.stringify({ a: 1, b: 2 }),
        array: JSON.stringify([1, 2, 3]),
        primitive: JSON.stringify('gold'),
        empty: '',
      },
      { object: '{}', array: '[]', primitive: '"x"', empty: '' },
      ['object', 'array', 'primitive', 'empty', 'absent'],
    )

    expect(result.map((d) => d.localSize)).toEqual([2, 3, 1, 0, 0])
    expect(result.map((d) => d.cloudSize)).toEqual([0, 0, 1, 0, 0])
    expect(result.map((d) => d.status)).toEqual([
      'grown',
      'grown',
      'same',
      'same',
      'same',
    ])
  })

  // クラウドにキーがあり保存内容に無い場合は、件数の大小より先に missing。
  it('reports a key the cloud has and the save does not as missing', () => {
    const result = diffKeys({}, { todoState: '[]' }, ['todoState'])

    expect(result[0]).toEqual({
      key: 'todoState',
      localSize: 0,
      cloudSize: 0,
      status: 'missing',
    })
  })

  it('keeps the given key order', () => {
    const keys = ['zeta', 'alpha', 'material', 'posession']
    const result = diffKeys({}, {}, keys)

    expect(result.map((d) => d.key)).toEqual(keys)
  })
})
