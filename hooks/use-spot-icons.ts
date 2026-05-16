'use client'

import { useEffect, useState } from 'react'

export function useSpotIcons(quests: Array<{ id: string; aaQuestId?: number } | null | undefined>) {
  const [icons, setIcons] = useState<Record<string, string>>({})

  const key = quests.map(q => q?.aaQuestId ?? '').join(',')

  useEffect(() => {
    const targets = quests.filter(
      (q): q is { id: string; aaQuestId: number } => Boolean(q?.id) && q?.aaQuestId != null
    )
    if (!targets.length) return

    Promise.allSettled(
      targets.map(q =>
        fetch(`/api/spot-icon?aaQuestId=${q.aaQuestId}`)
          .then(r => r.json() as Promise<{ imageUrl: string | null }>)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return icons
}
