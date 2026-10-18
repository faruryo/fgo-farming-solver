'use client'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Item } from '../../interfaces/fgodrop'
import { Localized } from '../../lib/get-local-items'
import { groupBy } from '../../utils/group-by'
import { ItemLink } from '../common/item-link'
import { PageHeader } from '../common/page-header'

export type ItemIndexProps = {
  items: Localized<Item>[]
  locale?: string
}

export const Index = ({ items }: ItemIndexProps) => {
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
        <PageHeader en="ITEM LIST" title={t('アイテム一覧')} />

        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-x-6 gap-y-10">
          {itemGroup.map(([largeCategory, itemGroups]) => (
            <div className="flex flex-col gap-4" key={largeCategory}>
              <div className="c-settings-section-label" style={{ width: '100%', display: 'flex' }}>
                {largeCategory}
              </div>
              <div className="flex flex-col gap-6 w-full">
                {itemGroups.map(([category, items]) => (
                  <div key={category} className="c-card p-4">
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--steel)',
                        marginBottom: '12px',
                        fontFamily: 'var(--serif)',
                        letterSpacing: '1px',
                        borderBottom: '1px solid var(--border)',
                        paddingBottom: '6px'
                      }}
                    >
                      {category}
                    </div>
                    <ul className="flex flex-col gap-3">
                      {items.map((item) => (
                        <li key={item.id}>
                          <ItemLink id={item.id} name={item.name} icon={item.icon} />
                        </li>
                      ))}
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
