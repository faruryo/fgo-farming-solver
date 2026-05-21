import React from 'react'
import Image from 'next/image'
import { Swords } from 'lucide-react'

type Props = {
  area: string
  name: string
  ap: number
  /** Original AP before campaign discount. When lower than ap, both values render side-by-side with an arrow. */
  originalAp?: number
  spotIcon?: string
  className?: string
}

export const QuestIdentity: React.FC<Props> = ({ area, name, ap, originalAp, spotIcon, className }) => {
  const isDiscounted = originalAp !== undefined && originalAp > ap

  return (
    <div className={`flex items-center gap-2 min-w-0 ${className ?? ''}`}>
      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded overflow-hidden">
        {spotIcon ? (
          <Image src={spotIcon} alt={area} width={32} height={32} className="w-full h-full object-contain" />
        ) : (
          <Swords size={15} style={{ color: 'var(--gold)' }} />
        )}
      </div>

      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[9px] font-medium truncate" style={{ color: 'var(--text3)' }}>{area}</span>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] font-bold truncate min-w-0" style={{ color: 'var(--navy)' }}>{name}</span>
          {isDiscounted ? (
            <span className="inline-flex items-baseline gap-1 text-[9px] tabular-nums flex-shrink-0">
              <span className="line-through opacity-60" style={{ color: 'var(--text3)' }}>{originalAp}</span>
              <span aria-hidden="true" style={{ color: 'var(--text3)' }}>→</span>
              <span className="font-bold" style={{ color: '#e89000' }}>{ap} AP</span>
            </span>
          ) : (
            <span className="text-[9px] flex-shrink-0" style={{ color: 'var(--text3)' }}>{ap} AP</span>
          )}
        </div>
      </div>
    </div>
  )
}
