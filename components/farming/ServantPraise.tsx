'use client'

import React from 'react'
import Image from 'next/image'
import { staticOrigin, region } from '../../constants/atlasacademy'
import type { ProgressTier } from '../../lib/progress/types'

// Mash Kyrielight (シールダー) — servant id 800100, ascension 0 face.
const MASHU_SERVANT_ID = 800100
const MASHU_FACE_URL = `${staticOrigin}/${region}/Faces/f_${MASHU_SERVANT_ID}0.png`

// legendary は large を上回る特別演出(達成感の視覚的演出 spec)。avatar のリングと
// 吹き出しの縁取りを強調色に変え、glow を追加する。他 tier は従来どおり控えめ。
const isLegendary = (tier: ProgressTier | undefined): boolean => tier === 'legendary'

export type ServantPraiseProps = {
  message: string
  /** Avatar size in px. Defaults to 64. */
  size?: number
  className?: string
  /** 進捗 tier。legendary のときだけ特別な配色・装飾を適用する。 */
  tier?: ProgressTier
}

export const ServantPraise: React.FC<ServantPraiseProps> = ({
  message,
  size = 64,
  className,
  tier,
}) => {
  const legendary = isLegendary(tier)
  return (
    <div className={`flex items-start gap-3 ${className ?? ''}`}>
      <Image
        src={MASHU_FACE_URL}
        alt="マシュ・キリエライト"
        width={size}
        height={size}
        className="rounded-full flex-shrink-0"
        style={{
          border: `2px solid ${legendary ? '#ff8c3c' : 'var(--gold, #d9b044)'}`,
          background: 'rgba(255,255,255,0.05)',
          boxShadow: legendary ? '0 0 12px rgba(255,140,60,0.5)' : undefined,
        }}
        unoptimized
      />
      <div
        className="relative rounded-lg px-3 py-2 text-sm"
        style={{
          background: legendary ? 'rgba(255,140,60,0.12)' : 'rgba(120,150,200,0.10)',
          border: `1px solid ${legendary ? 'rgba(255,140,60,0.4)' : 'rgba(120,150,200,0.25)'}`,
          boxShadow: legendary ? '0 0 10px rgba(255,140,60,0.2)' : undefined,
          flex: 1,
        }}
      >
        {message}
      </div>
    </div>
  )
}
