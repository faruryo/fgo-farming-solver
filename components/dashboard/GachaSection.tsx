import React from 'react'
import { Box, Image, Text, SimpleGrid, VStack, HStack, Badge, Tooltip } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { DashboardGacha } from '../../lib/master-data/types'
import { formatDuration } from '../../lib/format-duration'

interface GachaSectionProps {
  gachas: DashboardGacha[]
}

const GachaBanner: React.FC<{ image: DashboardGacha }> = ({ image }) => {
  const [srcIndex, setSrcIndex] = React.useState(0)
  
  // Try patterns in order
  const sources = React.useMemo(() => {
    const staticOrigin = image.banner.split('/JP/')[0]
    const list = [
      image.banner, // summon_{imageId}.png
      `${staticOrigin}/JP/Banner/gacha_banner_${image.id}.png`,
      `${staticOrigin}/JP/Banner/gacha_banner_stone_${image.id}.png`,
      `${staticOrigin}/JP/Banner/summon_banner_${image.id}.png`,
    ]
    
    if (image.fallbackBanner) {
      list.push(image.fallbackBanner)
    }
    
    return list
  }, [image])

  const handleError = () => {
    if (srcIndex < sources.length - 1) {
      setSrcIndex(srcIndex + 1)
    } else {
      setSrcIndex(-1)
    }
  }

  if (srcIndex === -1) {
    return (
      <Box 
        width="100%" 
        height="100%" 
        bgGradient="linear(to-br, blue.700, purple.800)"
        position="relative"
        overflow="hidden"
      >
        <Box 
          position="absolute" 
          top="-20%" 
          left="-10%" 
          width="140%" 
          height="140%" 
          bg="radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)"
          transform="rotate(-15deg)"
        />
        <VStack 
          height="100%" 
          justify="center" 
          p={4} 
          spacing={1}
          position="relative"
          zIndex={1}
        >
          <Badge 
            variant="outline" 
            colorScheme="whiteAlpha" 
            fontSize="9px" 
            px={2} 
            borderRadius="full"
            color="whiteAlpha.800"
          >
            PICKUP SUMMON
          </Badge>
          <Text 
            color="white" 
            fontSize="11px" 
            fontWeight="black" 
            textAlign="center" 
            noOfLines={2}
            lineHeight="shorter"
            textShadow="0 2px 4px rgba(0,0,0,0.3)"
          >
            {image.name}
          </Text>
        </VStack>
      </Box>
    )
  }

  return (
    <Image 
      src={sources[srcIndex]} 
      alt={image.name} 
      width="100%" 
      height="100%" 
      objectFit="cover" 
      onError={handleError}
    />
  )
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
              <GachaBanner image={gacha} />
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
                  {[...gacha.pickupServants]
                    .sort((a, b) => b.rarity - a.rarity)
                    .slice(0, 6)
                    .map(servant => (
                      <Tooltip key={servant.id} label={servant.name}>
                        <Box className={`u-face-frame rarity-${servant.rarity}`}>
                          <Image src={servant.face} alt={servant.name} />
                          <Box className="u-face-star">★</Box>
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
