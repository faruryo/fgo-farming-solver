'use client'

import { useEffect, useState } from 'react'

interface SpotIconResponse {
  imageUrl: string | null
}

const readJson = async <T>(response: Response): Promise<T> => {
  const value: unknown = await response.json()
  return value as T
}

export function useSpotIcons(quests: Array<{ id: string; aaQuestId?: number } | null | undefined>) {
  const [icons, setIcons] = useState<Record<string, string>>({})

  const key = quests.map(q => q?.aaQuestId ?? '').join(',')

  useEffect(() => {
    const targets = quests.filter(
      (q): q is { id: string; aaQuestId: number } => Boolean(q?.id) && q?.aaQuestId != null
    )
    if (!targets.length) return

    void Promise.allSettled(
      targets.map(q =>
        fetch(`/api/spot-icon?aaQuestId=${q.aaQuestId}`)
          .then(r => readJson<SpotIconResponse>(r))
          .then(({ imageUrl }) => ({ id: q.id, imageUrl }))
      )
    ).then(results => {
      const map: Record<string, string> = {}
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.imageUrl) {
          map[r.value.id] = r.value.imageUrl
        }
      }
      setIcons(map)
    })
  }, [key])

  return icons
}
