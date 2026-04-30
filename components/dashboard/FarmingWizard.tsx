import React, { useState } from 'react'
import { Box, VStack, HStack, Text, Button, Heading, IconButton } from '@chakra-ui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { FaChevronLeft, FaArrowRight } from 'react-icons/fa'
import { useRouter } from 'next/navigation'

const MotionBox = motion.create(Box)

export const FarmingWizard: React.FC = () => {
  const { t } = useTranslation(['dashboard'])
  const [step, setStep] = useState(1)
  const router = useRouter()

  const nextStep = () => setStep(s => s + 1)
  const prevStep = () => setStep(s => s - 1)

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 100 : -100,
      opacity: 0
    })
  }

  return (
    <Box className="u-fgo-card" p={8} bg="var(--navy)" color="white" borderRadius="xl" overflow="hidden" position="relative">
      <div className="u-section-header">
        <h2 className="u-section-header-title" style={{ color: 'var(--gold)' }}>{t('QUICK_START_WIZARD')}</h2>
        <div className="u-section-header-line" style={{ background: 'var(--gold-dim)' }} />
      </div>

      <Box height="200px" position="relative">
        <AnimatePresence initial={false} custom={step}>
          {step === 1 && (
            <MotionBox
              key="step1"
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              position="absolute"
              width="100%"
            >
              <VStack align="start" spacing={6}>
                <Heading size="md">{t('wizard-q1-title')}</Heading>
                <VStack align="stretch" width="100%" spacing={3}>
                  <Button 
                    variant="outline" 
                    colorScheme="yellow" 
                    justifyContent="space-between" 
                    rightIcon={<FaArrowRight />}
                    onClick={nextStep}
                  >
                    {t('育成素材の必要数を計算したい')}
                  </Button>
                  <Button 
                    variant="outline" 
                    colorScheme="blue" 
                    justifyContent="space-between" 
                    rightIcon={<FaArrowRight />}
                    onClick={() => router.push('/farming')}
                  >
                    {t('今の素材状況で最適な周回場所を探したい')}
                  </Button>
                </VStack>
              </VStack>
            </MotionBox>
          )}

          {step === 2 && (
            <MotionBox
              key="step2"
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              position="absolute"
              width="100%"
            >
              <VStack align="start" spacing={6}>
                <HStack>
                  <IconButton 
                    aria-label="back" 
                    icon={<FaChevronLeft />} 
                    size="sm" 
                    variant="ghost" 
                    onClick={prevStep}
                  />
                  <Heading size="md">{t('wizard-q2-title')}</Heading>
                </HStack>
                <Text fontSize="sm" color="gray.300">{t('どのサーヴァントを育てたいですか？')}</Text>
                <Button 
                  colorScheme="yellow" 
                  width="100%" 
                  onClick={() => router.push('/material')}
                >
                  {t('サーヴァント一覧から選択する')}
                </Button>
              </VStack>
            </MotionBox>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  )
}
