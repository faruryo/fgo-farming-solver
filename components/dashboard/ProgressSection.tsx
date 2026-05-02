import React, { useMemo } from 'react'
import { Box, SimpleGrid, Text, VStack, Heading } from '@chakra-ui/react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useTranslation } from 'react-i18next'
import { CHART_COLORS } from '../../constants/chart-colors'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { ChaldeaState } from '../../hooks/create-chaldea-state'
import NextLink from 'next/link'
import { Button } from '@chakra-ui/react'

export const ProgressSection: React.FC = () => {
  const { t } = useTranslation(['dashboard', 'common'])
  const [chaldea] = useLocalStorage<ChaldeaState>('material', {})

  const stats = useMemo(() => {
    if (!chaldea || Object.keys(chaldea).length === 0) return []

    const breakdown = {
      ascension: { current: 0, total: 0 },
      skill: { current: 0, total: 0 },
      append: { current: 0, total: 0 },
    }

    Object.values(chaldea).forEach(servant => {
      if (servant.disabled) return

      // Ascension
      const asc = servant.targets.ascension
      if (asc && !asc.disabled) {
        asc.ranges.forEach(r => {
          breakdown.ascension.current += r.start
          breakdown.ascension.total += r.end
        })
      }
      
      // Skills
      const sk = servant.targets.skill
      if (sk && !sk.disabled) {
        sk.ranges.forEach(r => {
          breakdown.skill.current += (r.start - 1)
          breakdown.skill.total += (r.end - 1)
        })
      }
      
      // Appends
      const ap = servant.targets.appendSkill
      if (ap && !ap.disabled) {
        ap.ranges.forEach(r => {
          breakdown.append.current += (r.start - 1)
          breakdown.append.total += (r.end - 1)
        })
      }
    })

    const data = [
      { name: t('再臨'), value: breakdown.ascension.current, total: breakdown.ascension.total, color: CHART_COLORS.ascension },
      { name: t('スキル'), value: breakdown.skill.current, total: breakdown.skill.total, color: CHART_COLORS.skill },
      { name: t('アペンド'), value: breakdown.append.current, total: breakdown.append.total, color: CHART_COLORS.append },
    ]

    return data.filter(d => d.total > 0)
  }, [chaldea, t])

  if (!stats || stats.length === 0) {
    return (
      <VStack align="stretch" spacing={6}>
        <div className="u-section-header">
          <h2 className="u-section-header-title">{t('あなたの育成進捗')}</h2>
          <div className="u-section-header-line" />
        </div>
        <Box p={8} className="u-fgo-card" bg="var(--panel2)" textAlign="center" borderRadius="xl">
          <VStack spacing={4}>
            <Text color="var(--text2)" fontWeight="bold">
              {t('目標が設定されていません')}
            </Text>
            <Text color="var(--text3)" fontSize="sm">
              {t('育成素材計算機で目標レベルを設定すると、全体の進捗がグラフで表示されます。')}
            </Text>
            <Button as={NextLink} href="/material" colorScheme="yellow" size="sm" mt={2}>
              {t('common:育成素材計算機へ')}
            </Button>
          </VStack>
        </Box>
      </VStack>
    )
  }

  return (
    <VStack align="stretch" spacing={6}>
      <div className="u-section-header">
        <h2 className="u-section-header-title">{t('あなたの育成進捗')}</h2>
        <div className="u-section-header-line" />
      </div>

      <SimpleGrid columns={[1, 1, 3]} spacing={6}>
        {stats.map(stat => {
          const percent = stat.total > 0 ? Math.round((stat.value / stat.total) * 100) : 0
          const chartData = [
            { name: 'Completed', value: stat.value },
            { name: 'Remaining', value: Math.max(0, stat.total - stat.value) },
          ]

          return (
            <Box key={stat.name} className="u-fgo-card" p={4} bg="var(--panel2)" borderRadius="md" position="relative">
              <VStack spacing={4}>
                <Box height="100px" width="100%" position="relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={45}
                        paddingAngle={2}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                        isAnimationActive={false}
                      >
                        <Cell fill={stat.color} stroke="none" />
                        <Cell fill="rgba(0,0,0,0.1)" stroke="none" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <Box 
                    position="absolute" 
                    top="50%" 
                    left="50%" 
                    transform="translate(-50%, -50%)"
                    textAlign="center"
                  >
                    <Text fontSize="md" fontWeight="bold" color="var(--navy)">{percent}%</Text>
                  </Box>
                </Box>
                <VStack spacing={0}>
                  <Heading size="xs" color="var(--text2)">{stat.name}</Heading>
                  <Text fontSize="10px" color="var(--text3)">
                    {stat.value} / {stat.total}
                  </Text>
                </VStack>
              </VStack>
            </Box>
          )
        })}
      </SimpleGrid>
    </VStack>
  )
}
