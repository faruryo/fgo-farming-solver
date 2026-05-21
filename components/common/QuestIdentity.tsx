import React from 'react'
import Image from 'next/image'
import { Swords } from 'lucide-react'

type Props = {
  area: string
  name: string
  ap: number
  /** Original AP before campaign discount. When provided and lower than ap, the discount ratio is shown as a badge. */
  originalAp?: number
  spotIcon?: string
  className?: string
}

// Atlas's multiplication discounts (e.g. 75%DOWN→value=250) reduce AP via
// Math.round(original * value/1000), so ratios like 13/40 land slightly off
// 1/3. Snap-to-nearest common fraction within tolerance keeps the badge
// readable; integer fixedValue campaigns (incl. 0 AP) get an exact label.
const FRACTION_GLYPHS: Array<[number, string]> = [
  [1 / 8, '⅛'],
  [1 / 6, '⅙'],
  [1 / 5, '⅕'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [2 / 5, '⅖'],
  [1 / 2, '½'],
  [3 / 5, '⅗'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [4 / 5, '⅘'],
  [5 / 6, '⅚'],
  [7 / 8, '⅞'],
]

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

const discountBadge = (ap: number, originalAp: number): string | null => {
  if (originalAp <= 0 || ap >= originalAp) return null
  if (ap === 0) return '0'
  const ratio = ap / originalAp
  for (const [val, glyph] of FRACTION_GLYPHS) {
    if (Math.abs(ratio - val) <= 0.02) return glyph
  }
  const g = gcd(ap, originalAp)
  return `${ap / g}/${originalAp / g}`
}

export const QuestIdentity: React.FC<Props> = ({ area, name, ap, originalAp, spotIcon, className }) => {
  const badge = originalAp !== undefined ? discountBadge(ap, originalAp) : null
  const isCampaignApplied = badge !== null

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
                {badge}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
