import React from 'react'
import Image from 'next/image'
import { Swords } from 'lucide-react'

type Props = {
  area: string
  name: string
  ap: number
  spotIcon?: string
  className?: string
}

export const QuestIdentity: React.FC<Props> = ({ area, name, ap, spotIcon, className }) => (
  <div className={`flex items-center gap-2 min-w-0 ${className ?? ''}`}>
    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded overflow-hidden">
      {spotIcon ? (
        <Image src={spotIcon} alt={area} width={32} height={32} className="w-full h-full object-contain" />
      ) : (
        <Swords size={15} style={{ color: 'var(--gold)' }} />
      )}
    </div>

    {/* テキスト列: AP → lapText の順で名前と同行に並べる */}
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[9px] font-medium truncate" style={{ color: 'var(--text3)' }}>{area}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[13px] font-bold truncate min-w-0" style={{ color: 'var(--navy)' }}>{name}</span>
        <span className="text-[9px] flex-shrink-0" style={{ color: 'var(--text3)' }}>
          {ap} AP
        </span>
      </div>
    </div>
  </div>
)
