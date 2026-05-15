'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { FaChevronLeft, FaArrowRight } from 'react-icons/fa'
import { useRouter } from 'next/navigation'
import { useRecentResult } from '../../hooks/use-recent-result'

export const FarmingWizard: React.FC = () => {
  const { t } = useTranslation(['dashboard'])
  const [step, setStep] = useState(1)
  const router = useRouter()
  const { historyCount, loading } = useRecentResult()

  const nextStep = () => setStep(s => s + 1)
  const prevStep = () => setStep(s => s - 1)

  if (loading || historyCount >= 3) return null

  const variants = {
    enter: (direction: number) => ({ x: direction > 0 ? 100 : -100, opacity: 0 }),
    center: { zIndex: 1, x: 0, opacity: 1 },
    exit: (direction: number) => ({ zIndex: 0, x: direction < 0 ? 100 : -100, opacity: 0 }),
  }

  return (
    <div
      className="u-fgo-card relative overflow-hidden rounded-xl p-8"
      style={{ background: 'var(--navy)', color: 'white' }}
    >
      <div className="u-section-header">
        <h2 className="u-section-header-title" style={{ color: 'var(--gold)' }}>{t('QUICK_START_WIZARD')}</h2>
        <div className="u-section-header-line" style={{ background: 'var(--gold-dim)' }} />
      </div>

      <div className="relative h-[200px]">
        <AnimatePresence initial={false} custom={step}>
          {step === 1 && (
            <motion.div
              key="step1"
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute w-full"
            >
              <div className="flex flex-col items-start gap-6">
                <h3 className="text-base font-semibold">{t('wizard-q1-title')}</h3>
                <div className="flex flex-col w-full gap-3">
                  <Button
                    variant="outline"
                    className="justify-between border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
                    onClick={nextStep}
                  >
                    {t('育成素材の必要数を計算したい')}
                    <FaArrowRight />
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-between border-blue-400 text-blue-400 hover:bg-blue-400/10"
                    onClick={() => router.push('/farming')}
                  >
                    {t('今の素材状況で最適な周回場所を探したい')}
                    <FaArrowRight />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute w-full"
            >
              <div className="flex flex-col items-start gap-6">
                <div className="flex items-center gap-2">
                  <Button aria-label="back" size="icon" variant="ghost" onClick={prevStep} className="h-8 w-8">
                    <FaChevronLeft />
                  </Button>
                  <h3 className="text-base font-semibold">{t('wizard-q2-title')}</h3>
                </div>
                <p className="text-sm" style={{ color: 'rgba(200,218,240,0.7)' }}>
                  {t('どのサーヴァントを育てたいですか？')}
                </p>
                <Button
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-black"
                  onClick={() => router.push('/material')}
                >
                  {t('サーヴァント一覧から選択する')}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
