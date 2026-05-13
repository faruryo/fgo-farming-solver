 
import React, { useMemo } from 'react'
import { Box, Text, VStack, HStack, Image, Badge, SimpleGrid, Spinner } from '@chakra-ui/react'
import NextLink from 'next/link'
import { useTranslation } from 'react-i18next'
import { useDrops } from '../../hooks/use-drops'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { ChaldeaState } from '../../hooks/create-chaldea-state'
import { getItemIconUrl } from '../../lib/get-item-icon-url'
import { useRecentResult } from '../../hooks/use-recent-result'
import { isBothResult, Quest } from '../../interfaces/api'

export const RecommendedQuest: React.FC = () => {
  const { t } = useTranslation(['dashboard'])
  const [chaldea] = useLocalStorage<ChaldeaState>('material', {})
  const { items, quests, drop_rates, isLoading: dropsLoading } = useDrops()
  const { result: recentResult, loading: resultLoading } = useRecentResult()

  const recommendations = useMemo(() => {
    if (dropsLoading || !items || !items.length || !quests || !drop_rates) return []

    // 1. 直近の計算結果があればそれを優先して表示
    if (recentResult) {
      const targetQuests = isBothResult(recentResult) ? recentResult.lap.quests : recentResult.quests
      const targetItems = isBothResult(recentResult) ? recentResult.lap.items : recentResult.items
      const targetDropRates = isBothResult(recentResult) ? recentResult.lap.drop_rates : recentResult.drop_rates

      if (targetQuests && targetQuests.length > 0) {
        return targetQuests
          .sort((a, b) => {
            const getPriority = (q: Quest) => {
              if (q.area?.includes('冠位研鑽戦')) return 1
              if (q.area?.includes('オーディール・コール')) return 2
              return 3
            }
            const pa = getPriority(a)
            const pb = getPriority(b)
            if (pa !== pb) return pa - pb
            return b.lap - a.lap
          })
          .slice(0, 4)
          .map((q: Quest) => {
          // Find the primary item being farmed in this quest
          const relatedRates = targetDropRates.filter(dr => dr.quest_id === q.id)
          // Find which target item has the highest drop rate here
          const bestRate = relatedRates
            .filter(dr => targetItems.some(ti => ti.id === dr.item_id))
            .sort((a, b) => b.drop_rate - a.drop_rate)[0] || relatedRates[0]

          const item = items.find(i => i.id === bestRate?.item_id)
          
          return {
            id: q.id,
            item,
            quest: q,
            rate: bestRate?.drop_rate,
            lap: q.lap,
            isRecent: true
          }
        })
      }
    }

    // 2. 履歴がない場合は簡易ヒューリスティック (目標の素材のドロップ率が高いクエスト)
    const targetServantIds = Object.keys(chaldea)
    if (targetServantIds.length === 0) return []

    return items.slice(0, 3).map(item => {
      const bestRate = drop_rates
        .filter(dr => dr.item_id === item.id)
        .sort((a, b) => b.drop_rate - a.drop_rate)[0]
      
      const quest = bestRate ? quests.find(q => q.id === bestRate.quest_id) : null
      
      return {
        id: quest?.id || item.id,
        item,
        quest,
        rate: bestRate?.drop_rate,
        lap: 0,
        isRecent: false
      }
    }).filter(r => r.quest)
  }, [items, quests, drop_rates, chaldea, dropsLoading, recentResult])

  if (dropsLoading || resultLoading) {
    return (
      <VStack align="stretch" spacing={6}>
        <div className="u-section-header">
          <h2 className="u-section-header-title">{t('推奨周回クエスト')}</h2>
          <div className="u-section-header-line" />
        </div>
        <Box p={4} textAlign="center"><Spinner color="var(--gold)" /></Box>
      </VStack>
    )
  }

  if (recommendations.length === 0) return null

  return (
    <VStack align="stretch" spacing={3}>
      <div className="u-section-header">
        <h2 className="u-section-header-title">{recentResult ? t('直近の周回予定') : t('推奨周回クエスト')}</h2>
        <div className="u-section-header-line" />
      </div>

      <SimpleGrid columns={1} spacing={3}>
        {recommendations.map(({ id, item, quest, rate, lap, isRecent }) => (
          <Box
            key={id}
            as={NextLink}
            href={`/quests/${quest?.id}`}
            className="u-fgo-card"
            py={2}
            px={3}
            bg="var(--panel2)"
            display="flex"
            alignItems="flex-start"
            gap={3}
            _hover={{ transform: 'translateY(-2px)', shadow: 'xl', bg: 'var(--panel3)' }}
            transition="all 0.2s"
            cursor="pointer"
          >
            <Box width="36px" height="36px" flexShrink={0} mt={0.5}>
              {item && <Image src={getItemIconUrl(item.icon)} alt={item.name} fallbackSrc="https://via.placeholder.com/36" />}
            </Box>
            <Box flex={1} minW={0}>
              {item && (
                <Text fontSize="10px" color="var(--text3)" noOfLines={1}>
                  {isRecent ? t('主なドロップ') : t('不足素材')}: {item.name}
                </Text>
              )}
              <Text fontSize="sm" fontWeight="bold" color="var(--navy)" noOfLines={1}>
                {quest?.name}
              </Text>
              <HStack spacing={2} mt={0.5} flexWrap="wrap">
                <Text fontSize="10px" color="var(--text2)">{quest?.area}</Text>
                <Text fontSize="10px" color="var(--text3)">{quest?.ap} AP</Text>
                {lap ? (
                  <Badge colorScheme="blue" variant="solid" fontSize="10px">
                    {lap} {t('周')}
                  </Badge>
                ) : (
                  <Badge colorScheme="green" variant="solid" fontSize="10px">
                    {Math.round((rate || 0) * 100)}%
                  </Badge>
                )}
              </HStack>
            </Box>
          </Box>
        ))}
      </SimpleGrid>
    </VStack>
  )
}
