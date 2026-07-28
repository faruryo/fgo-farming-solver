'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from 'react-i18next'
import { DashboardGacha } from '../../lib/master-data/types'
import { formatDuration } from '../../lib/format-duration'
import { Link } from '../common/link'

interface GachaSectionProps {
  gachas: DashboardGacha[]
}

const GachaBanner: React.FC<{ image: DashboardGacha }> = ({ image }) => {
  const [srcIndex, setSrcIndex] = React.useState(0)

  const sources = React.useMemo(() => {
    const staticOrigin = image.banner.split('/JP/')[0]
    return [
      image.banner,
      `${staticOrigin}/JP/Banner/gacha_banner_${image.id}.png`,
      `${staticOrigin}/JP/Banner/gacha_banner_stone_${image.id}.png`,
      `${staticOrigin}/JP/Banner/summon_banner_${image.id}.png`,
    ]
  }, [image])

  const handleError = () => {
    if (srcIndex < sources.length - 1) setSrcIndex(srcIndex + 1)
    else setSrcIndex(-1)
  }

  if (srcIndex === -1) {
    return (
      <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-blue-700 to-purple-800">
        <div className="absolute top-[-20%] left-[-10%] w-[140%] h-[140%] -rotate-15"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)' }} />
        <div className="relative z-10 flex flex-col items-center justify-center h-full gap-1 p-4">
          <span className="text-[9px] border border-white/50 rounded-full px-2 text-white/80">PICKUP SUMMON</span>
          <p className="text-[11px] font-black text-center text-white leading-tight line-clamp-2"
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {image.name}
          </p>
        </div>
      </div>
    )
  }

  return (
    <img
      src={sources[srcIndex]}
      alt={image.name}
      className="w-full h-full object-cover"
      onError={handleError}
    />
  )
}

export const GachaSection: React.FC<GachaSectionProps> = ({ gachas }) => {
  const { t } = useTranslation(['dashboard'])

  if (gachas.length === 0) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="u-section-header">
        <h2 className="u-section-header-title">{t('開催中の召喚')}</h2>
        <div className="u-section-header-line" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {gachas.map(gacha => (
          <div
            key={gacha.id}
            className="u-fgo-card rounded-md overflow-hidden flex flex-col"
            style={{ background: 'var(--panel2)' }}
          >
            <div className="relative h-[120px]" style={{ background: 'var(--panel)' }}>
              <GachaBanner image={gacha} />
              <div className="absolute top-0 right-0 p-1">
                <Badge className="text-[10px] bg-blue-500 text-white">{formatDuration(gacha.closedAt)}</Badge>
              </div>
            </div>

            <div className="p-4 flex-1">
              <div className="flex flex-col gap-3">
                <p className="text-[11px] font-bold" style={{ color: 'var(--text3)' }}>{t('ピックアップ対象')}</p>
                <div className="flex flex-wrap gap-2">
                  {[...gacha.pickupServants]
                    .sort((a, b) => b.rarity - a.rarity)
                    .slice(0, 6)
                    .map(servant => (
                      <Tooltip key={servant.id}>
                        <TooltipTrigger render={<span />}>
                          <Link href={`/material#svt-${servant.id}`} className="block">
                            <div className={`u-face-frame rarity-${servant.rarity}`}>
                              <img src={servant.face} alt={servant.name} />
                            </div>
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>{servant.name}</TooltipContent>
                      </Tooltip>
                    ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
