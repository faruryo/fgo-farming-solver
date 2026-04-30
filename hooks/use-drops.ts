import { useState, useEffect } from 'react'
import { Drops } from '../lib/get-drops'

export const useDrops = () => {
  const [data, setData] = useState<Drops>({ items: [], quests: [], drop_rates: [] })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/drops')
        if (response.ok) {
          const json: Drops = await response.json()
          setData(json)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }
    void fetchData()
  }, [])

  return { ...data, isLoading }
}
