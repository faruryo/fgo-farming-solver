import React from 'react'
import { Box, Image, Text, SimpleGrid, VStack, HStack, Badge, Tooltip } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { DashboardEvent } from '../../lib/master-data/types'
import { formatDuration } from '../../lib/format-duration'

interface EventSectionProps {
  events: DashboardEvent[]
}

export const EventSection: React.FC<EventSectionProps> = ({ events }) => {
  const { t } = useTranslation(['dashboard'])

  if (events.length === 0) return null

  return (
    <VStack align="stretch" spacing={6}>
      <div className="u-section-header">
        <h2 className="u-section-header-title">{t('開催中のイベント')}</h2>
        <div className="u-section-header-line" />
      </div>

      {events.map(event => (
        <Box 
          key={event.id} 
          className="u-fgo-card"
          borderRadius="lg"
          overflow="hidden"
          boxShadow="xl"
          transition="transform 0.2s"
          _hover={{ transform: 'translateY(-2px)' }}
        >
          {/* Banner */}
          <Box position="relative" height={['120px', '160px', '200px']} bg="var(--panel2)">
            <Image 
              src={event.banner} 
              alt={event.name} 
              width="100%" 
              height="100%" 
              objectFit="cover" 
              fallbackSrc="https://via.placeholder.com/800x400?text=FGO+Event+Banner"
            />
            <Box 
              position="absolute" 
              bottom={0} 
              left={0} 
              right={0} 
              p={4} 
              bg="linear-gradient(transparent, rgba(10, 22, 34, 0.9))"
            >
              <Text color="white" fontWeight="bold" fontSize="lg" noOfLines={1}>
                {event.name}
              </Text>
            </Box>
          </Box>

          {/* Details */}
          <Box p={4} bg="var(--panel2)">
            <SimpleGrid columns={[1, 1, 2]} spacing={4} mb={4}>
              <VStack align="start" spacing={1}>
                <Text fontSize="xs" color="var(--text3)" fontWeight="bold">
                  {t('クエスト終了まで')}
                </Text>
                <Badge colorScheme="red" variant="subtle" fontSize="sm" px={2} py={0.5}>
                  {formatDuration(event.endedAt)}
                </Badge>
              </VStack>
              <VStack align="start" spacing={1}>
                <Text fontSize="xs" color="var(--text3)" fontWeight="bold">
                  {t('アイテム交換終了まで')}
                </Text>
                <Badge colorScheme="orange" variant="outline" fontSize="sm" px={2} py={0.5}>
                  {formatDuration(event.shopFinishedAt)}
                </Badge>
              </VStack>
            </SimpleGrid>

            {/* Drops */}
            <VStack align="start" spacing={2}>
              <Text fontSize="xs" color="var(--text3)" fontWeight="bold">
                {t('獲得可能アイテム')}
              </Text>
              <HStack spacing={2} wrap="wrap">
                {event.drops.slice(0, 15).map(drop => (
                  <Tooltip key={drop.id} label={drop.name}>
                    <Box 
                      width="42px" 
                      height="42px" 
                      border="1px solid var(--border)" 
                      borderRadius="md"
                      bg="var(--bg2)"
                      overflow="hidden"
                    >
                      <Image src={drop.icon} alt={drop.name} width="100%" height="100%" />
                    </Box>
                  </Tooltip>
                ))}
                {event.drops.length > 15 && (
                  <Text fontSize="xs" color="var(--text3)">
                    + {event.drops.length - 15} items
                  </Text>
                )}
              </HStack>
            </VStack>
          </Box>
        </Box>
      ))}
    </VStack>
  )
}
