import { describe, expect, it, vi } from 'vitest'
import { POST } from './route'

const post = (body: string) =>
  POST(new Request('http://localhost/api/event-craft-data-gap', { method: 'POST', body }))

describe('POST /api/event-craft-data-gap', () => {
  it('妥当な欠落だけを1行ログし、生ボディは出さない', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const res = await post(
      JSON.stringify({
        gaps: [{ atlasId: 6518, reason: 'absent', possession: 4 }],
        userId: 'sub',
      }),
    )
    expect(res.status).toBe(204)
    expect(info).toHaveBeenCalledTimes(1)
    expect(info.mock.calls[0]?.[0]).toBe(
      '{"event":"craft_data_gap","count":1,"absent":[6518],"unrated":[]}',
    )
    info.mockRestore()
  })

  it('不正 reason と 41件は 400 でログしない', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const badReason = await post(JSON.stringify({ gaps: [{ atlasId: 1, reason: 'gone' }] }))
    expect(badReason.status).toBe(400)
    const tooMany = await post(
      JSON.stringify({
        gaps: Array.from({ length: 41 }, (_, i) => ({ atlasId: i + 1, reason: 'absent' })),
      }),
    )
    expect(tooMany.status).toBe(400)
    expect(info).not.toHaveBeenCalled()
    info.mockRestore()
  })
})
