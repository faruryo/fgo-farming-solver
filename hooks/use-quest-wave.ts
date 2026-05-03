import { useState, useEffect } from 'react'
import { origin, region } from '../constants/atlasacademy'
import type { Wave } from '../lib/master-data/types'

const ATTRIBUTE_MAP: Record<string, string> = {
  man: '人', human: '人', earth: '地',
  sky: '天', heaven: '天', star: '星', beast: '獣',
}

export function useQuestWave(aaQuestId?: number): { waves: Wave[] | undefined; isLoading: boolean } {
  const [waves, setWaves] = useState<Wave[] | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!aaQuestId) return

    let cancelled = false
    setIsLoading(true)
    setWaves(undefined)

    fetch(`${origin}/nice/${region}/quest/${aaQuestId}/1`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: any) => {
        if (cancelled) return
        if (data.stages) {
          setWaves(data.stages.map((stage: any) => ({
            enemies: stage.enemies.map((enemy: any) => ({
              name: enemy.svt.name,
              className: enemy.svt.className,
              hp: enemy.hp,
              attribute: ATTRIBUTE_MAP[enemy.svt.attribute] ?? enemy.svt.attribute,
            })),
          })))
        }
      })
      .catch(() => {
        if (!cancelled) setWaves(undefined)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [aaQuestId])

  return { waves, isLoading }
}
