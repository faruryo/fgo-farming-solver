

'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import Image from 'next/image'
import { Servant, ClassName } from '../../interfaces/atlas-academy'
import { staticOrigin, region } from '../../constants/atlasacademy'
import { getClassName } from '../../lib/class-names'
import { getClassIconUrl } from '../../lib/get-class-icon-url'
import { groupBy } from '../../utils/group-by'
import { orderBy } from '../../utils/order-by'
import { Link } from '../common/link'
import { ServantStars } from '../common/ServantStars'

const BEAST_CLASSES = new Set<ClassName>(['beast', 'beastEresh', 'unBeastOlgaMarie'])
const normalizeBeastClass = (className: ClassName): ClassName =>
  BEAST_CLASSES.has(className) ? 'beast' : className

export type ServantIndexProps = { servants: Servant[]; locale?: string }

export const Index = ({ servants, locale = 'ja' }: ServantIndexProps) => {
  const { t } = useTranslation('servants')
  const servantGroups = Object.entries(
    groupBy(servants, ({ className }) => normalizeBeastClass(className))
  ).map(([className, servants]): [string, [string, Servant[]][]] => [
    className,
    Object.entries(groupBy(servants, ({ rarity }) => rarity)).sort(
      orderBy(([rarity]) => parseInt(rarity), 'desc')
    ),
  ])
  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="c-page-header">
          <div>
            <div className="c-page-en">SERVANT LIST</div>
            <h1 className="c-page-title">{t('サーヴァント一覧')}</h1>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-x-6 gap-y-10">
          {servantGroups.map(([className, servantGroups]) => (
            <div className="flex flex-col gap-4" key={className}>
              <div className="flex flex-col gap-6 w-full">
                {servantGroups.map(([rarity, servants]) => (
                  <div key={rarity} className="c-card p-4">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '10px',
                        paddingBottom: '8px',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {(() => {
                        const iconUrl = getClassIconUrl(className as ClassName, 5)
                        return iconUrl
                          ? <Image src={iconUrl} alt={className} width={16} height={16} style={{ objectFit: 'contain' }} />
                          : null
                      })()}
                      <span style={{ fontSize: '12px', color: 'var(--text2)', fontFamily: 'var(--serif)' }}>
                        {getClassName(className as ClassName, locale)}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--steel)', margin: '0 2px' }}>|</span>
                      <ServantStars
                        rarity={parseInt(rarity)}
                        style={{ fontSize: '11px', color: 'var(--gold)', fontFamily: 'var(--serif)' }}
                        aria-label={`Rarity ${rarity}`}
                      />
                    </div>
                    <ul className="flex flex-col gap-3">
                      {servants.map((servant) => {
                        const faceUrl = `${staticOrigin}/${region}/Faces/f_${servant.id * 10}.png`
                        return (
                          <li key={servant.id}>
                            <div className="flex items-center gap-2">
                              <Image
                                src={faceUrl}
                                alt={servant.name}
                                width={24}
                                height={24}
                                style={{ objectFit: 'contain', borderRadius: '2px' }}
                              />
                              <Link href={`/servants/${servant.id}`} color="var(--text)">
                                {servant.name}
                              </Link>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
