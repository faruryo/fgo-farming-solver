import React, { useMemo } from 'react'
import { Box, Text, VStack, Image, Badge, SimpleGrid } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { useDrops } from '../../hooks/use-drops'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { ChaldeaState } from '../../hooks/create-chaldea-state'

export const RecommendedQuest: React.FC = () => {
  const { t } = useTranslation(['dashboard'])
  const [chaldea] = useLocalStorage<ChaldeaState>('chaldea', {})
  const { items, quests, drop_rates, isLoading } = useDrops()

  // Find most needed items
  const recommendations = useMemo(() => {
    if (isLoading || !items || !items.length || !quests || !drop_rates) return []

    // 1. 本来は chaldea 状態から不足素材を計算するが、
    // ここでは簡易的に chaldea に登録されている（＝目標がある）サーヴァントに関連する素材を推奨とする
    const targetServantIds = Object.keys(chaldea)
    if (targetServantIds.length === 0) return []

    // 簡易ロジック: 最初の3つのアイテムに対して最適なクエストを表示
    return items.slice(0, 3).map(item => {
      const bestRate = drop_rates
        .filter(dr => dr.item_id === item.id)
        .sort((a, b) => b.drop_rate - a.drop_rate)[0]
      
      const quest = bestRate ? quests.find(q => q.id === bestRate.quest_id) : null
      
      return {
        item,
        quest,
        rate: bestRate?.drop_rate
      }
    }).filter(r => r.quest)
  }, [items, quests, drop_rates, chaldea, isLoading])

  if (isLoading || recommendations.length === 0) return null

  return (
    <VStack align="stretch" spacing={6}>
      <div className="u-section-header">
        <h2 className="u-section-header-title">{t('推奨周回クエスト')}</h2>
        <div className="u-section-header-line" />
      </div>

      <SimpleGrid columns={[1, 1, 2]} spacing={4}>
        {recommendations.map(({ item, quest, rate }) => (
          <Box 
            key={item.id} 
            className="u-fgo-card" 
            p={4} 
            bg="var(--panel2)"
            display="flex"
            alignItems="center"
            gap={4}
          >
            <Box width="48px" height="48px" flexShrink={0}>
               <Image src={`/assets/items/${item.id}.webp`} alt={item.name} fallbackSrc="https://via.placeholder.com/48" />
            </Box>
            <VStack align="start" spacing={0} flex={1}>
              <Text fontSize="xs" color="var(--text3)">{t('不足素材')}: {item.name}</Text>
              <Text fontSize="md" fontWeight="bold" color="var(--navy)">{quest?.name}</Text>
              <Text fontSize="xs" color="var(--text2)">{quest?.area}</Text>
            </VStack>
            <VStack align="end" spacing={1}>
              <Badge colorScheme="green" variant="solid">
                {Math.round((rate || 0) * 100)}%
              </Badge>
              <Text fontSize="10px" color="var(--text3)">{quest?.ap} AP</Text>
            </VStack>
          </Box>
        ))}
      </SimpleGrid>
    </VStack>
  )
}
