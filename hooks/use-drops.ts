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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          setData(await response.json())
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
