/* eslint-disable */
'use client'

import React from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  Heading,
  HStack,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react'
import { BreadcrumbLink } from '../common/breadcrumb-link'
import { MaterialList } from './material-list'
import { useTranslation } from 'react-i18next'
import { TargetKey, NiceServant, Item } from '../../interfaces/atlas-academy'
import { getClassName } from '../../lib/class-names'
import { Title } from '../common/title'

export type ServantProps = {
  servant: NiceServant
  items: Item[]
  locale?: string
}

const keys: TargetKey[] = ['ascension', 'skill', 'appendSkill']

export const Page = ({
  servant,
  items,
  locale = 'ja',
}: ServantProps) => {
  const { t } = useTranslation(['servants', 'common'])
  const title = t('title', { name: servant.name })

  return (
    <VStack align="stretch" spacing={16}>
      <Breadcrumb>
        <BreadcrumbItem>
          <BreadcrumbLink href="/servants">
            {t('サーヴァント一覧')}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <Text>{title}</Text>
        </BreadcrumbItem>
      </Breadcrumb>
      <VStack>
        <HStack>
          <Text color="yellow.500">{'★'.repeat(servant.rarity)}</Text>
          <Text>{getClassName(servant.className, locale)}</Text>
        </HStack>
        <Title>{title}</Title>
      </VStack>
      <SimpleGrid minChildWidth="250px" spacing={8}>
        {keys.map((key) => (
          <VStack align="stretch" key={key} spacing={4}>
            <Heading size="lg">{t(key, { ns: 'common' })}</Heading>
            <MaterialList
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
              materials={servant[(key + 'Materials') as keyof NiceServant] as any}
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
              items={items as any}
            />
          </VStack>
        ))}
      </SimpleGrid>
    </VStack>
  )
}
