import React from 'react'
import { Box, Image, Text, SimpleGrid, VStack, HStack, Badge, Tooltip } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { DashboardGacha } from '../../lib/master-data/update'
import { formatDuration } from '../../lib/format-duration'

interface GachaSectionProps {
  gachas: DashboardGacha[]
}

export const GachaSection: React.FC<GachaSectionProps> = ({ gachas }) => {
  const { t } = useTranslation(['dashboard'])

  if (gachas.length === 0) return null

  return (
    <VStack align="stretch" spacing={6}>
      <div className="u-section-header">
        <h2 className="u-section-header-title">{t('開催中の召喚')}</h2>
        <div className="u-section-header-line" />
      </div>

      <SimpleGrid columns={[1, 1, 2, 3]} spacing={4}>
        {gachas.map(gacha => (
          <Box 
            key={gacha.id} 
            className="u-fgo-card"
            borderRadius="md"
            overflow="hidden"
            bg="var(--panel2)"
            display="flex"
            flexDirection="column"
          >
            {/* Banner */}
            <Box position="relative" height="120px" bg="var(--panel1)">
              <Image 
                src={gacha.banner} 
                alt={gacha.name} 
                width="100%" 
                height="100%" 
                objectFit="cover" 
                fallbackSrc="https://via.placeholder.com/400x200?text=FGO+Gacha+Banner"
              />
              <Box 
                position="absolute" 
                top={0} 
                right={0} 
                p={1}
              >
                <Badge colorScheme="blue" variant="solid" fontSize="10px">
                  {formatDuration(gacha.closedAt)}
                </Badge>
              </Box>
            </Box>

            {/* Pickups */}
            <Box p={3} flex="1">
              <VStack align="start" spacing={2}>
                <Text fontSize="11px" color="var(--text3)" fontWeight="bold">
                  {t('ピックアップ対象')}
                </Text>
                <HStack spacing={2} wrap="wrap">
                  {gacha.pickupServants.slice(0, 6).map(servant => (
                    <Tooltip key={servant.id} label={servant.name}>
                      <Box className="u-face-frame">
                        <Image src={servant.face} alt={servant.name} />
                      </Box>
                    </Tooltip>
                  ))}
                </HStack>
              </VStack>
            </Box>
          </Box>
        ))}
      </SimpleGrid>
    </VStack>
  )
}
