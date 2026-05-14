import React from 'react'
import { Box, Image, Text, VStack, HStack, Badge, Tooltip } from '@chakra-ui/react'
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
    <VStack align="stretch" spacing={3}>
      <div className="u-section-header">
        <h2 className="u-section-header-title">{t('開催中のイベント')}</h2>
        <div className="u-section-header-line" />
      </div>

      {events.map(event => (
        <Box
          key={event.id}
          className="u-fgo-card"
          borderRadius="md"
          overflow="hidden"
          bg="var(--panel2)"
          transition="transform 0.2s"
          _hover={{ transform: 'translateY(-2px)' }}
        >
          {/* バナーストリップ（全幅・適度な高さ） */}
          <Box position="relative" height="110px" bg="var(--panel3)">
            <Image
              src={event.banner}
              alt={event.name}
              width="100%"
              height="100%"
              objectFit="cover"
              objectPosition="center center"
              fallbackSrc="https://via.placeholder.com/800x110?text=Event"
            />
            <Box
              position="absolute"
              bottom={0}
              left={0}
              right={0}
              px={3}
              py={1.5}
              bg="linear-gradient(transparent, rgba(10,22,34,0.85))"
            >
              <Text color="white" fontWeight="bold" fontSize="xs" noOfLines={1}>
                {event.name}
              </Text>
            </Box>
          </Box>

          {/* 詳細行 */}
          <Box px={3} py={2}>
            <HStack spacing={2} justify="space-between" flexWrap="wrap">
              <HStack spacing={2} flexWrap="wrap">
                <Badge colorScheme="red" variant="subtle" fontSize="10px">
                  クエスト {formatDuration(event.endedAt)}
                </Badge>
                {event.shopFinishedAt && (
                  <Badge colorScheme="orange" variant="outline" fontSize="10px">
                    交換所 {formatDuration(event.shopFinishedAt)}
                  </Badge>
                )}
              </HStack>
              {event.drops.length > 0 && (
                <HStack spacing={1}>
                  {event.drops.slice(0, 8).map(drop => (
                    <Tooltip key={drop.id} label={drop.name}>
                      <Box width="22px" height="22px" borderRadius="sm" overflow="hidden" bg="var(--bg2)" flexShrink={0}>
                        <Image src={drop.icon} alt={drop.name} width="100%" height="100%" />
                      </Box>
                    </Tooltip>
                  ))}
                  {event.drops.length > 8 && (
                    <Text fontSize="10px" color="var(--text3)">+{event.drops.length - 8}</Text>
                  )}
                </HStack>
              )}
            </HStack>
          </Box>
        </Box>
      ))}
    </VStack>
  )
}
