'use client'

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { FaChevronLeft, FaMapMarkerAlt, FaBolt, FaLayerGroup } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { useDrops } from '../../../hooks/use-drops'
import { useQuestWave } from '../../../hooks/use-quest-wave'
import { Quest } from '../../../interfaces/api'
import { Badge } from '@/components/ui/badge'
import { ItemIdentity } from '../../../components/common/ItemIdentity'
import { Button } from '@/components/ui/button'

export default function QuestDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  useTranslation(['dashboard'])
  const { quests, isLoading } = useDrops()

  const quest = quests?.find(q => q.id === id) as Quest | undefined
  const { waves, isLoading: isWaveLoading } = useQuestWave(quest?.aaQuestId)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: 'var(--gold)' }} />
      </div>
    )
  }

  if (!quest) {
    return (
      <div className="c-page">
        <div className="c-page-inner flex flex-col items-center gap-6 py-20">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--navy)' }}>Quest Not Found</h2>
          <p style={{ color: 'var(--text2)' }}>The quest you are looking for does not exist or has been removed.</p>
          <Button variant="ghost" onClick={() => router.back()}>
            <FaChevronLeft className="mr-2" /> Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-10 pt-14" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 py-4 border-b backdrop-blur-[10px]"
        style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center gap-4">
            <Button
              aria-label="Back"
              variant="ghost"
              size="icon"
              style={{ color: 'var(--text)' }}
              onClick={() => router.back()}
            >
              <FaChevronLeft />
            </Button>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-wider" style={{ color: 'var(--gold)' }}>
                {quest.section === 'Daily' ? 'DAILY QUEST' : 'FREE QUEST'}
              </span>
              <h2 className="text-base font-semibold" style={{ color: 'var(--navy)' }}>{quest.name}</h2>
            </div>
            <div className="flex-1 flex justify-end">
              <Badge className="px-3 py-1 rounded-full">{quest.ap} AP</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info Column */}
          <div className="md:col-span-2 flex flex-col gap-6">
            <div className="c-card p-6">
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-3" style={{ color: 'var(--text2)' }}>
                  <FaMapMarkerAlt />
                  <span className="font-medium">{quest.area}</span>
                </div>

                <hr style={{ borderColor: 'var(--border)', opacity: 0.3 }} />

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <FaLayerGroup style={{ color: 'var(--gold)' }} />
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>Wave Details</h3>
                  </div>

                  {isWaveLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--gold)' }} />
                    </div>
                  ) : waves && waves.length > 0 ? (
                    <div className="flex flex-col gap-6">
                      {waves.map((wave, wIdx) => (
                        <div key={wIdx} className="p-4 rounded-xl border-l-4" style={{ background: 'rgba(0,0,0,0.2)', borderLeftColor: 'var(--gold)' }}>
                          <div className="flex justify-between items-center mb-3">
                            <Badge variant="outline">WAVE {wIdx + 1}</Badge>
                            <span className="text-xs" style={{ color: 'var(--text3)' }}>{wave.enemies.length} ENEMIES</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {wave.enemies.map((enemy: any, eIdx: number) => (
                              <div
                                key={eIdx}
                                className="p-3 rounded-lg border relative overflow-hidden"
                                style={{ background: 'var(--panel3)', borderColor: 'var(--border)' }}
                              >
                                <div className="flex flex-col gap-1">
                                  <div className="flex justify-between items-center w-full">
                                    <Badge className="text-[10px]">{enemy.className.toUpperCase()}</Badge>
                                    <span className="text-[10px]" style={{ color: 'var(--text3)' }}>{enemy.attribute}</span>
                                  </div>
                                  <p className="text-sm font-bold truncate">{enemy.name}</p>
                                  <div className="flex items-center gap-1" style={{ color: 'var(--text2)' }}>
                                    <span className="text-xs">HP:</span>
                                    <span className="text-xs font-bold">{enemy.hp.toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center rounded-xl border-2 border-dashed" style={{ borderColor: 'var(--border)' }}>
                      <p className="mb-3" style={{ color: 'var(--text3)' }}>Enemy data not available for this quest.</p>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(`FGO ${quest.area} ${quest.name} 周回`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:underline"
                        style={{ color: 'var(--gold)' }}
                      >
                        「{quest.area} {quest.name}」をGoogleで検索 →
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar / Drop Info */}
          <div className="flex flex-col gap-6">
            <div className="c-card p-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <FaBolt style={{ color: 'var(--gold)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>Drop Information</h3>
                </div>
                <p className="text-xs" style={{ color: 'var(--text3)' }}>Material drop rates based on community data.</p>
                <QuestDropInfo questId={quest.id} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const QuestDropInfo: React.FC<{ questId: string }> = ({ questId }) => {
  const { items, drop_rates } = useDrops()
  const relevantRates = drop_rates?.filter(dr => dr.quest_id === questId).sort((a, b) => b.drop_rate - a.drop_rate)

  if (!relevantRates || relevantRates.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--text3)' }}>No drop data available.</p>
  }

  return (
    <div className="flex flex-col gap-3 mt-2">
      {relevantRates.map(dr => {
        const item = items?.find(i => i.id === dr.item_id)
        if (!item) return null
        return (
          <div key={dr.item_id} className="flex items-center gap-3 p-2 rounded-md" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <ItemIdentity icon={item.icon} name={item.name} size={32} />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs font-bold truncate">{item.name}</span>
              <span className="text-[10px]" style={{ color: 'var(--text3)' }}>{Math.round(dr.drop_rate * 100)}% Drop</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
