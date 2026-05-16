'use client'

import React from 'react'
import Image from 'next/image'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { BreadcrumbLink } from '../common/breadcrumb-link'
import { MaterialList } from './material-list'
import { useTranslation } from 'react-i18next'
import { NiceServant, Item, Materials } from '../../interfaces/atlas-academy'
import { getClassName } from '../../lib/class-names'
import { getClassIconUrl } from '../../lib/get-class-icon-url'

export type ServantProps = {
  servant: NiceServant
  items: Item[]
  locale?: string
}

export const Page = ({
  servant,
  items,
  locale = 'ja',
}: ServantProps) => {
  const { t } = useTranslation(['servants', 'common'])
  const title = t('title', { name: servant.name })
  const portrait = servant.extraAssets.charaGraph.ascension?.[4] || Object.values(servant.extraAssets.charaGraph.ascension || {}).pop()
  const classIconUrl = getClassIconUrl(servant.className, servant.rarity)

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
              {classIconUrl ? (
                <Image
                  src={classIconUrl}
                  alt={getClassName(servant.className, locale)}
                  width={32}
                  height={32}
                  style={{ objectFit: 'contain' }}
                />
              ) : (
                <div className="c-stat-num" style={{ fontSize: '14px' }}>
                  {getClassName(servant.className, locale)}
                </div>
              )}
              <div className="c-stat-label">CLASS</div>
            </div>
          </div>
        </div>

        <div className="c-servant-detail-top">
          {portrait && (
            <div className="c-servant-detail-portrait mx-auto md:mx-0">
              <Image
                src={portrait}
                alt={servant.name}
                width={240}
                height={340}
                style={{ height: 'auto', width: '100%', display: 'block' }}
              />
            </div>
          )}
          <div className="flex flex-col gap-8 flex-1">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/servants">
                    {t('サーヴァント一覧')}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage style={{ color: 'var(--text3)' }}>{title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {[
            { id: 'ascension',   label: t('common:ascension'),   key: 'ascensionMaterials' },
            { id: 'skill',       label: t('common:skill'),        key: 'skillMaterials' },
            { id: 'appendSkill', label: t('common:appendSkill'),  key: 'appendSkillMaterials' },
          ].map((section) => {
            const materials = servant[section.key as keyof NiceServant] as unknown as Materials
            if (!materials || Object.keys(materials).length === 0) return null

            return (
              <div key={section.id} className="c-card p-6">
                <div className="c-settings-section-label mb-4 flex" style={{ color: 'var(--gold2)' }}>
                  {section.label}
                </div>
                <MaterialList materials={materials} items={items} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
