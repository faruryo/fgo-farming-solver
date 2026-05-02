/* eslint-disable */
'use client'

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Box, Container, IconButton, Heading, Text, VStack, HStack, SimpleGrid, Badge, Image, Divider, Card, CardBody, Spinner, Flex } from '@chakra-ui/react'
import { FaChevronLeft, FaInfoCircle, FaMapMarkerAlt, FaBolt, FaLayerGroup } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'
import { useDrops } from '../../../hooks/use-drops'
import { Quest } from '../../../interfaces/api'
import { getItemIconUrl } from '../../../lib/get-item-icon-url'

export default function QuestDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { t } = useTranslation(['dashboard'])
  const { quests, isLoading } = useDrops()

  const quest = quests?.find(q => q.id === id) as Quest | undefined

  if (isLoading) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <Spinner size="xl" color="var(--gold)" thickness="4px" />
      </Flex>
    )
  }

  if (!quest) {
    return (
      <Container maxW="container.lg" py={20}>
        <VStack spacing={6}>
          <Heading color="var(--navy)">Quest Not Found</Heading>
          <Text color="var(--text2)">The quest you are looking for does not exist or has been removed.</Text>
          <IconButton 
            aria-label="Go back" 
            icon={<FaChevronLeft />} 
            onClick={() => router.back()}
            variant="ghost"
          >
            Back to Dashboard
          </IconButton>
        </VStack>
      </Container>
    )
  }

  return (
    <Box minH="100vh" bg="var(--bg)" pb={10}>
      {/* Header */}
      <Box 
        bg="var(--panel)" 
        backdropFilter="blur(10px)" 
        borderBottom="1px solid var(--border)"
        position="sticky"
        top={0}
        zIndex={10}
        py={4}
      >
        <Container maxW="container.lg">
          <HStack spacing={4}>
            <IconButton
              aria-label="Back"
              icon={<FaChevronLeft />}
              variant="ghost"
              color="var(--text)"
              onClick={() => router.back()}
              _hover={{ bg: 'rgba(255,255,255,0.1)' }}
            />
            <VStack align="start" spacing={0}>
              <Text fontSize="xs" color="var(--gold)" fontWeight="bold" letterSpacing="wider">
                {quest.section === 'Daily' ? 'DAILY QUEST' : 'FREE QUEST'}
              </Text>
              <Heading size="md" color="var(--navy)">{quest.name}</Heading>
            </VStack>
            <Flex flex={1} justify="end">
               <Badge colorScheme="purple" variant="solid" px={3} py={1} borderRadius="full">
                 {quest.ap} AP
               </Badge>
            </Flex>
          </HStack>
        </Container>
      </Box>

      <Container maxW="container.lg" pt={6}>
        <SimpleGrid columns={[1, 1, 3]} spacing={6}>
          {/* Main Info Column */}
          <VStack align="stretch" spacing={6} gridColumn={['span 1', 'span 1', 'span 2']}>
            <Card variant="outline" bg="var(--panel2)" border="none" className="u-fgo-card">
              <CardBody>
                <VStack align="stretch" spacing={6}>
                  <HStack spacing={3} color="var(--text2)">
                    <FaMapMarkerAlt />
                    <Text fontWeight="medium">{quest.area}</Text>
                  </HStack>
                  
                  <Divider borderColor="var(--border)" opacity={0.3} />

                  <Box>
                    <HStack spacing={2} mb={4}>
                      <FaLayerGroup color="var(--gold)" />
                      <Heading size="sm" color="var(--navy)">Wave Details</Heading>
                    </HStack>

                    {quest.waves && quest.waves.length > 0 ? (
                      <VStack align="stretch" spacing={6}>
                        {quest.waves.map((wave, wIdx) => (
                          <Box key={wIdx} p={4} bg="rgba(0,0,0,0.2)" borderRadius="xl" borderLeft="4px solid var(--gold)">
                            <HStack justify="space-between" mb={3}>
                              <Badge variant="outline" colorScheme="yellow">WAVE {wIdx + 1}</Badge>
                              <Text fontSize="xs" color="var(--text3)">{wave.enemies.length} ENEMIES</Text>
                            </HStack>
                            <SimpleGrid columns={[1, 2, 3]} spacing={3}>
                              {wave.enemies.map((enemy: any, eIdx: number) => (
                                <Box 
                                  key={eIdx} 
                                  p={3} 
                                  bg="var(--panel3)" 
                                  borderRadius="lg" 
                                  border="1px solid var(--border)"
                                  position="relative"
                                  overflow="hidden"
                                >
                                  <VStack align="start" spacing={1}>
                                    <HStack spacing={2} width="100%" justify="space-between">
                                      <Badge size="xs" colorScheme={enemy.className === 'archer' ? 'green' : enemy.className === 'saber' ? 'red' : 'blue'}>
                                        {enemy.className.toUpperCase()}
                                      </Badge>
                                      <Badge variant="ghost" colorScheme="orange" fontSize="10px">
                                        {enemy.attribute}
                                      </Badge>
                                    </HStack>
                                    <Text fontSize="sm" fontWeight="bold" noOfLines={1}>{enemy.name}</Text>
                                    <HStack spacing={1} color="var(--text2)">
                                      <Text fontSize="xs">HP:</Text>
                                      <Text fontSize="xs" fontWeight="bold">{enemy.hp.toLocaleString()}</Text>
                                    </HStack>
                                  </VStack>
                                </Box>
                              ))}
                            </SimpleGrid>
                          </Box>
                        ))}
                      </VStack>
                    ) : (
                      <Box p={8} textAlign="center" border="2px dashed var(--border)" borderRadius="xl">
                        <Text color="var(--text3)">Enemy data not available for this quest.</Text>
                      </Box>
                    )}
                  </Box>
                </VStack>
              </CardBody>
            </Card>
          </VStack>

          {/* Sidebar / Drop Info */}
          <VStack align="stretch" spacing={6}>
            <Card variant="outline" bg="var(--panel2)" border="none" className="u-fgo-card">
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <HStack spacing={2}>
                    <FaBolt color="var(--gold)" />
                    <Heading size="sm" color="var(--navy)">Drop Information</Heading>
                  </HStack>
                  <Text fontSize="xs" color="var(--text3)">Material drop rates based on community data.</Text>
                  
                  {/* We would need drop rates for this quest here. 
                      Since we have useDrops, we can filter them. */}
                  <QuestDropInfo questId={quest.id} />
                </VStack>
              </CardBody>
            </Card>
          </VStack>
        </SimpleGrid>
      </Container>
    </Box>
  )
}

const QuestDropInfo: React.FC<{ questId: string }> = ({ questId }) => {
  const { items, drop_rates } = useDrops()
  const relevantRates = drop_rates?.filter(dr => dr.quest_id === questId).sort((a, b) => b.drop_rate - a.drop_rate)

  if (!relevantRates || relevantRates.length === 0) return <Text fontSize="sm" color="var(--text3)">No drop data available.</Text>

  return (
    <VStack align="stretch" spacing={3} mt={2}>
      {relevantRates.map(dr => {
        const item = items?.find(i => i.id === dr.item_id)
        if (!item) return null
        return (
          <HStack key={dr.item_id} spacing={3} p={2} bg="rgba(255,255,255,0.05)" borderRadius="md">
            <Box width="32px" height="32px">
              <Image src={getItemIconUrl(item.icon) || `https://via.placeholder.com/32`} alt={item.name} />
            </Box>
            <VStack align="start" spacing={0} flex={1}>
              <Text fontSize="xs" fontWeight="bold" noOfLines={1}>{item.name}</Text>
              <Text fontSize="10px" color="var(--text3)">{Math.round(dr.drop_rate * 100)}% Drop</Text>
            </VStack>
          </HStack>
        )
      })}
    </VStack>
  )
}
