import React from 'react'
import { Box, Image, Text, SimpleGrid, VStack, HStack, Badge } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { RecentServant } from '../../lib/master-data/update'
import { motion } from 'framer-motion'
import { Link } from '../common/link'

const MotionBox = motion.create(Box)

interface RecentServantSectionProps {
  servants: RecentServant[]
}

export const RecentServantSection: React.FC<RecentServantSectionProps> = ({ servants }) => {
  const { t } = useTranslation(['dashboard', 'common'])

  if (servants.length === 0) return null

  return (
    <VStack align="stretch" spacing={6}>
      <div className="u-section-header">
        <h2 className="u-section-header-title">{t('最近追加されたサーヴァント')}</h2>
        <div className="u-section-header-line" />
      </div>

      <SimpleGrid columns={[2, 3, 4, 5, 6]} spacing={4}>
        {servants.map((servant) => (
          <Link
            key={servant.id}
            href={`/material#svt-${servant.id}`}
            _hover={{ textDecoration: 'none' }}
          >
            <MotionBox
              whileHover={{ y: -4 }}
              className="c-card"
              p={3}
              bg="var(--panel2)"
              borderRadius="md"
              position="relative"
              overflow="hidden"
              height="100%"
            >
              <VStack spacing={2}>
                <Box className="u-face-frame" width="60px" height="60px">
                  <Image src={servant.face} alt={servant.name} />
                </Box>
                <VStack spacing={0} align="center">
                  <Text fontSize="xs" fontWeight="bold" color="var(--text1)" noOfLines={1} textAlign="center">
                    {servant.name}
                  </Text>
                  <HStack spacing={0.5}>
                    {Array.from({ length: servant.rarity }).map((_, i) => (
                      <Text key={i} color="var(--gold)" fontSize="10px">★</Text>
                    ))}
                  </HStack>
                </VStack>
                <Badge variant="subtle" colorScheme="gray" fontSize="9px" borderRadius="full" px={2}>
                  {new Date(servant.releasedAt * 1000).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                </Badge>
              </VStack>
            </MotionBox>
          </Link>
        ))}
      </SimpleGrid>
    </VStack>
  )
}
