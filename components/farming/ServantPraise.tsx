'use client'

import React from 'react'
import Image from 'next/image'
import { staticOrigin, region } from '../../constants/atlasacademy'

// Mash Kyrielight (シールダー) — servant id 800100, ascension 0 face.
const MASHU_SERVANT_ID = 800100
const MASHU_FACE_URL = `${staticOrigin}/${region}/Faces/f_${MASHU_SERVANT_ID}0.png`

export type ServantPraiseProps = {
  message: string
  /** Avatar size in px. Defaults to 64. */
  size?: number
  className?: string
}

export const ServantPraise: React.FC<ServantPraiseProps> = ({
  message,
  size = 64,
  className,
}) => (
  <div className={`flex items-start gap-3 ${className ?? ''}`}>
    <Image
      src={MASHU_FACE_URL}
      alt="マシュ・キリエライト"
      width={size}
      height={size}
      className="rounded-full flex-shrink-0"
      style={{
        border: '2px solid var(--gold, #d9b044)',
        background: 'rgba(255,255,255,0.05)',
      }}
      unoptimized
    />
    <div
      className="relative rounded-lg px-3 py-2 text-sm"
      style={{
        background: 'rgba(120,150,200,0.10)',
        border: '1px solid rgba(120,150,200,0.25)',
        flex: 1,
      }}
    >
      {message}
    </div>
  </div>
)
