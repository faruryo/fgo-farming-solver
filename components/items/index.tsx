 
/* eslint-disable */
'use client'

import { List, ListItem, SimpleGrid, VStack } from '@chakra-ui/react'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Item } from '../../interfaces/fgodrop'
import { Localized } from '../../lib/get-local-items'
import { groupBy } from '../../utils/group-by'
import { ItemLink } from '../common/item-link'

export type ItemIndexProps = {
  items: Localized<Item>[]
  locale?: string
}

export const Index = ({ items, locale = 'ja' }: ItemIndexProps) => {
  const { t } = useTranslation('items')
  const itemGroup = useMemo(
    () =>
      Object.entries(
        groupBy(items, ({ largeCategory }) => largeCategory)
      ).map(([largeCategory, items]): [string, [string, Localized<Item>[]][]] => [
        largeCategory,
        Object.entries(groupBy(items, ({ category }) => category)),
      ]),
    [items]
  )
  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="c-page-header">
          <div>
            <div className="c-page-en">ITEM LIST</div>
            <h1 className="c-page-title">{t('アイテム一覧')}</h1>
          </div>
        </div>

        <SimpleGrid minChildWidth="300px" spacingX={6} spacingY={10}>
          {itemGroup.map(([largeCategory, itemGroups]) => (
            <VStack align="start" key={largeCategory} spacing={4}>
              <div className="c-settings-section-label" style={{ width: '100%', display: 'flex' }}>
                {largeCategory}
              </div>
              <VStack spacing={6} align="stretch" width="100%">
                {itemGroups.map(([category, items]) => (
                  <div key={category} className="c-card" style={{ padding: '16px' }}>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--steel)',
                        marginBottom: '10px',
                        fontFamily: 'var(--serif)',
                        letterSpacing: '1px',
                        borderBottom: '1px solid var(--border)',
                        paddingBottom: '4px'
                      }}
                    >
                      {category}
                    </div>
                    <List spacing={2}>
                      {items.map((item) => (
                        <ListItem key={item.id}>
                          <ItemLink id={item.id} name={item.name} icon={item.icon} />
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
