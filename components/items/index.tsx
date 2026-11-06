'use client'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Item } from '../../interfaces/fgodrop'
import { Localized } from '../../lib/get-local-items'
import { groupBy } from '../../utils/group-by'
import { ItemLink } from '../common/item-link'
import { ItemWantToggle } from '../common/item-want-toggle'
import { PageHeader } from '../common/page-header'
import { useItemWantSetting } from '../../hooks/use-item-want-setting'
import { itemWantKey } from '../../lib/item-want-setting'

export type ItemIndexProps = {
  items: Localized<Item>[]
  locale?: string
}

/**
 * 品目の行。品目の詳細へのリンクと、Atlas の番号の分かる行だけ「欲しい／いらない」の切り替えを並べる。
 * 切り替えはリンクの外に置き、押しても詳細へ移らない。
 */
const ItemRow = ({ item, want }: { item: Localized<Item>; want: ReturnType<typeof useItemWantSetting> }) => {
  const key = item.atlasId === undefined ? undefined : itemWantKey(item.atlasId)
  return (
    // 名前と切り替えが1行に収まらないときは、名前を省略せずに切り替えを次の行へ折り返す。
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <ItemLink id={item.id} name={item.name} icon={item.icon} />
      {/* 設定を読み終えるまでは、未設定の「欲しい」として見せないよう切り替えを出さない。 */}
      {want.loaded && key !== undefined && (
        <ItemWantToggle
          name={item.name}
          wanted={!want.unwanted.has(key)}
          onChange={wanted => want.setWanted(key, wanted)}
        />
      )}
    </li>
  )
}

export const Index = ({ items }: ItemIndexProps) => {
  const { t } = useTranslation('items')
  const want = useItemWantSetting()
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
                        <ItemRow key={item.id} item={item} want={want} />
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
