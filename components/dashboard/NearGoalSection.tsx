'use client'
import React, { useMemo } from 'react'
import { Box, VStack, Text, HStack, SimpleGrid } from '@chakra-ui/react'
import Image from 'next/image'
import NextLink from 'next/link'
import { useDrops } from '../../hooks/use-drops'
import { useRecentResult } from '../../hooks/use-recent-result'
import { isBothResult } from '../../interfaces/api'
import { getItemIconUrl } from '../../lib/get-item-icon-url'

export const NearGoalSection: React.FC = () => {
  const { items: dropItems, isLoading: dropsLoading } = useDrops()
  const { result: recentResult, loading: resultLoading } = useRecentResult()

  const nearGoalEntries = useMemo(() => {
    if (!recentResult || !dropItems?.length) return []

    const result = isBothResult(recentResult) ? recentResult.lap : recentResult
    const { quests: targetQuests, drop_rates: targetDropRates, items: targetItems, params } = result

    if (!targetQuests?.length || !targetItems?.length) return []

    const maxLap = Math.max(...targetQuests.map(q => q.lap))
    const threshold = Math.max(50, maxLap * 0.3)

    return targetItems
      .flatMap(ti => {
        const needed = params.items[ti.id] ?? 0
        if (needed <= 0) return []

        const best = targetDropRates
          .filter(dr => dr.item_id === ti.id && dr.drop_rate > 0)
          .map(dr => {
            const quest = targetQuests.find(q => q.id === dr.quest_id)
            if (!quest) return null
            return { quest, lapsNeeded: Math.ceil(needed / dr.drop_rate) }
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
          .sort((a, b) => a.lapsNeeded - b.lapsNeeded)[0]

        if (!best || best.lapsNeeded > threshold) return []

        const displayItem = dropItems.find(i => i.id === ti.id)
        if (!displayItem) return []

        return [{ item: displayItem, quest: best.quest, needed, lapsNeeded: best.lapsNeeded }]
      })
      .sort((a, b) => a.lapsNeeded - b.lapsNeeded)
      .slice(0, 4)
  }, [dropItems, recentResult])

  if (dropsLoading || resultLoading || nearGoalEntries.length === 0) return null

  return (
    <VStack align="stretch" spacing={3}>
      <div className="u-section-header">
        <h2 className="u-section-header-title">もうすぐ達成！</h2>
        <div className="u-section-header-line" />
      </div>
      <SimpleGrid columns={1} spacing={3}>
        {nearGoalEntries.map(({ item, quest, needed, lapsNeeded }) => {
          const isVeryClose = lapsNeeded <= 10
          return (
            <Box
              key={item.id}
              as={NextLink}
              href={`/quests/${quest.id}`}
              className="u-fgo-card"
              py={2}
              px={3}
              bg="var(--panel2)"
              borderRadius="md"
              display="flex"
              alignItems="flex-start"
              gap={3}
              borderLeft="3px solid"
              borderLeftColor={isVeryClose ? '#60c890' : 'var(--gold)'}
              _hover={{ bg: 'var(--panel3)', textDecoration: 'none' }}
              transition="background 0.15s"
            >
              {item.icon && (
                <Image
                  src={getItemIconUrl(item.icon)}
                  alt={item.name}
                  width={36}
                  height={36}
                  style={{ flexShrink: 0, marginTop: '2px' }}
                />
              )}
              <Box flex={1} minW={0}>
                <Text
                  fontSize="10px"
                  color={isVeryClose ? '#60c890' : 'var(--gold)'}
                  fontWeight="semibold"
                  noOfLines={1}
                >
                  あと{lapsNeeded}周で達成！
                </Text>
                <Text fontSize="sm" fontWeight="bold" color="var(--navy)" noOfLines={1}>
                  {item.name}
                </Text>
                <HStack spacing={1} mt={0.5}>
                  <Text fontSize="10px" color="var(--text3)" noOfLines={1}>
                    あと{needed}個 · {quest.area} · {quest.name}
                  </Text>
                </HStack>
              </Box>
            </Box>
          )
        })}
      </SimpleGrid>
    </VStack>
  )
}
