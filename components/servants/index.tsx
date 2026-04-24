/* eslint-disable */
/* eslint-disable */
'use client'

import { Heading, List, ListItem, SimpleGrid, VStack } from '@chakra-ui/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Servant, ClassName } from '../../interfaces/atlas-academy'
import { getClassName } from '../../lib/class-names'
import { groupBy } from '../../utils/group-by'
import { orderBy } from '../../utils/order-by'
import { Link } from '../common/link'
import { Title } from '../common/title'

export type ServantIndexProps = { servants: Servant[]; locale?: string }

export const Index = ({ servants, locale = 'ja' }: ServantIndexProps) => {
  const { t } = useTranslation('servants')
  const servantGroups = Object.entries(
    groupBy(servants, ({ className }) => className)
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
              <div className="c-settings-section-label" style={{ width: '100%', display: 'flex' }}>
                {getClassName(className as ClassName, locale)}
              </div>
              <VStack spacing={6} align="stretch" width="100%">
                {servantGroups.map(([rarity, servants]) => (
                  <div key={rarity} className="c-card" style={{ padding: '12px 16px' }}>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--gold)',
                        marginBottom: '8px',
                        fontFamily: 'var(--serif)',
                        letterSpacing: '2px'
                      }}
                      aria-label={`Rarity ${rarity}`}
                    >
                      {'✦'.repeat(parseInt(rarity))}
                    </div>
                    <List spacing={2}>
                      {servants.map((servant) => (
                        <ListItem key={servant.id}>
                          <Link href={`/servants/${servant.id}`} color="var(--text)" _hover={{ color: 'var(--gold)', textDecoration: 'none' }}>
                            {servant.name}
                          </Link>
                        </ListItem>
                      ))}
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
