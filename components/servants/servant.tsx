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
  const portrait = servant.extraAssets.charaGraph.ascension?.[4] || Object.values(servant.extraAssets.charaGraph.ascension || {}).pop()

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="c-page-header">
          <div>
            <div className="c-page-en">SERVANT DETAIL</div>
            <h1 className="c-page-title">{title}</h1>
          </div>
          <div className="c-stats">
            <div className="c-stat">
              <div className="c-stat-num">{servant.rarity}</div>
              <div className="c-stat-label">STARS</div>
            </div>
            <div className="c-stat">
              <div className="c-stat-num" style={{ fontSize: '14px' }}>{getClassName(servant.className, locale)}</div>
              <div className="c-stat-label">CLASS</div>
            </div>
          </div>
        </div>

        <div className="c-servant-detail-top">
          {portrait && (
            <div className="c-servant-detail-portrait">
              <img src={portrait} alt={servant.name} />
            </div>
          )}
          <VStack align="stretch" spacing={8} flex={1}>
            <Breadcrumb>
              <BreadcrumbItem>
                <BreadcrumbLink href="/servants">
                  {t('サーヴァント一覧')}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem isCurrentPage>
                <Text color="var(--text3)">{title}</Text>
              </BreadcrumbItem>
            </Breadcrumb>
            
            {/* ... other info can go here ... */}
          </VStack>
        </div>

          <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={6}>
            {[
              { id: 'ascension', label: '霊基再臨', key: 'ascensionMaterials' },
              { id: 'skill', label: 'スキル', key: 'skillMaterials' },
              { id: 'app1', label: 'アペンド 1', key: 'appendSkill1Materials' },
              { id: 'app2', label: 'アペンド 2', key: 'appendSkill2Materials' },
              { id: 'app3', label: 'アペンド 3', key: 'appendSkill3Materials' },
              { id: 'app4', label: 'アペンド 4', key: 'appendSkill4Materials' },
              { id: 'app5', label: 'アペンド 5', key: 'appendSkill5Materials' },
            ].map((section) => {
              const materials = servant[section.key as keyof NiceServant] as any
              if (!materials || Object.keys(materials).length === 0) return null

              return (
                <div key={section.id} className="c-card" style={{ padding: '24px' }}>
                  <div className="c-settings-section-label" style={{ marginBottom: '16px', display: 'flex', color: 'var(--gold2)' }}>
                    {section.label}
                  </div>
                  <MaterialList
                    materials={materials}
                    items={items}
                  />
                </div>
              )
            })}
          </SimpleGrid>
        </VStack>
      </div>
    </div>
  )
}
