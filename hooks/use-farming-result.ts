import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Item, Quest } from '../interfaces/api'
import { orderBy } from '../utils/order-by'

export const useFarmingResult = (items: Item[], quests: Quest[]) => {
  const { t } = useTranslation('farming')
  return useMemo(() => {
    const weights = [1, 2, 4, 0.25, 0.75, 4, 1, 2]
    const displayedItems = items
      .slice()
      .sort(
        orderBy(({ id, count }) => count * weights[parseInt(id?.[0])], 'desc')
      )
      .slice(0, 3)
      .map(({ name, count }) => t('required', { name, count }))
      .join(t('comma'))
    const displayedLaps = quests
      .slice()
      .sort(orderBy(({ lap }) => lap, 'desc'))
      .slice(0, 3)
      .map(({ area, name, lap }) => t('runs', { area, name, lap }))
      .join('\r\n')
    const total = t('total', {
      lap: quests.map(({ lap }) => lap).reduce((acc, cur) => acc + cur, 0),
    })
    const iaso = items.length > 3 ? t('and-so-on') : ''
    const qaso = quests.length > 3 ? t('and-so-on') : ''
    return t('text', {
      items: displayedItems,
      iaso,
      quests: displayedLaps,
      qaso,
      total,
    })
  }, [items, quests, t])
}
