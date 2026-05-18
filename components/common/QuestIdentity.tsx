import React from 'react'
import Image from 'next/image'
import { Swords } from 'lucide-react'

type Props = {
  area: string
  name: string
  ap: number
  /** Original AP before campaign discount. When provided and differs from ap, shows a ½ badge. */
  originalAp?: number
  spotIcon?: string
  className?: string
}

export const QuestIdentity: React.FC<Props> = ({ area, name, ap, originalAp, spotIcon, className }) => {
  const isCampaignApplied = originalAp !== undefined && ap < originalAp

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
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-[9px]" style={{ color: isCampaignApplied ? '#e89000' : 'var(--text3)' }}>
              {ap} AP
            </span>
            {isCampaignApplied && (
              <span
                className="text-[8px] font-bold px-1 py-px rounded leading-none"
                style={{ background: 'rgba(250,170,0,0.15)', color: '#e89000', border: '1px solid rgba(250,170,0,0.35)' }}
              >
                ½
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
