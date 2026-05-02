/* eslint-disable */
/* eslint-disable */
'use client'

import { HStack, List, ListItem, SimpleGrid, VStack } from '@chakra-ui/react'
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

        <SimpleGrid minChildWidth="300px" spacingX={6} spacingY={10}>
          {servantGroups.map(([className, servantGroups]) => (
            <VStack align="start" key={className} spacing={4}>
              <VStack spacing={6} align="stretch" width="100%">
                {servantGroups.map(([rarity, servants]) => (
                  <div key={rarity} className="c-card" style={{ padding: '12px 16px' }}>
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
                      <span
                        style={{ fontSize: '11px', color: 'var(--gold)', fontFamily: 'var(--serif)', letterSpacing: '2px' }}
                        aria-label={`Rarity ${rarity}`}
                      >
                        {'✦'.repeat(parseInt(rarity))}
                      </span>
                    </div>
                    <List spacing={2}>
                      {servants.map((servant) => {
                        const faceUrl = `${staticOrigin}/${region}/Faces/f_${servant.id * 10}.png`
                        return (
                          <ListItem key={servant.id}>
                            <HStack spacing={2} display="inline-flex" align="center">
                              <Image
                                src={faceUrl}
                                alt={servant.name}
                                width={24}
                                height={24}
                                style={{ objectFit: 'contain', borderRadius: '2px' }}
                              />
                              <Link href={`/servants/${servant.id}`} color="var(--text)" _hover={{ color: 'var(--gold)', textDecoration: 'none' }}>
                                {servant.name}
                              </Link>
                            </HStack>
                          </ListItem>
                        )
                      })}
                    </List>
                  </div>
                ))}
              </VStack>
            </VStack>
          ))}
        </SimpleGrid>
      </div>
    </div>
  )
}
