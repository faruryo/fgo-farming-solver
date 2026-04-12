/* eslint-disable */
/* eslint-disable */
'use client'

import { Heading, List, ListItem, SimpleGrid, VStack } from '@chakra-ui/react'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Item } from '../../interfaces/fgodrop'
import { Localized } from '../../lib/get-local-items'
import { groupBy } from '../../utils/group-by'
import { Link } from '../common/link'
import { Title } from '../common/title'

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
    <VStack alignItems="stretch" spacing={8}>
      <Title>{t('アイテム一覧')}</Title>
      <SimpleGrid minChildWidth="300px" spacingX={3} spacingY={8}>
        {itemGroup.map(([largeCategory, itemGroups]) => (
          <VStack align="start" key={largeCategory}>
            <Heading size="lg">{largeCategory}</Heading>
            <VStack spacing={4} align="start">
              {itemGroups.map(([category, items]) => (
                <VStack key={category} align="start">
                  <Heading size="sm" color="gray.500">
                    {category}
                  </Heading>
                  <List spacing={1}>
                    {items.map((item) => (
                      <ListItem key={item.id}>
                        <Link href={`/items/${item.id}`}>{item.name}</Link>
                      </ListItem>
                    ))}
                  </List>
                </VStack>
              ))}
            </VStack>
          </VStack>
        ))}
      </SimpleGrid>
    </VStack>
  )
}
