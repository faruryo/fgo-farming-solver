'use client'

import React from 'react'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import type { EventShopItem } from '../../lib/master-data/types'
import { groupShopByCurrency, type ShopCurrencyGroup } from '../../lib/event-shop-summary'

const Icon: React.FC<{ src?: string }> = ({ src }) =>
  src ? <Image src={src} alt="" width={20} height={20} className="w-5 h-5 object-contain flex-shrink-0" /> : null

const CurrencyHeader: React.FC<{ group: ShopCurrencyGroup }> = ({ group }) => {
  const { t } = useTranslation('events')
  return (
    <div
      className="flex items-center justify-between gap-2 flex-wrap px-4 py-3"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text1)' }}>
        <Icon src={group.costIcon} />
        {group.costName || t('event-shop-currency-id', 'ID {{id}}', { id: group.costItemId })}
      </h3>
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text2)' }}>
        <span>{t('event-shop-total', '全交換 {{total}}', { total: group.totalCost.toLocaleString() })}</span>
        {group.unlimitedCount > 0 && (
          <span style={{ color: 'var(--text3)' }}>
            {t('event-shop-unlimited-count', '＋上限なし {{count}} 品目', { count: group.unlimitedCount })}
          </span>
        )}
      </div>
    </div>
  )
}

const ShopRow: React.FC<{ item: EventShopItem }> = ({ item }) => {
  const { t } = useTranslation('events')
  return (
    <tr style={{ borderTop: '1px solid var(--border)', color: 'var(--text2)' }}>
      <td className="px-4 py-2">
        <span className="flex items-center gap-2">
          <Icon src={item.icon} />
          <span>{item.name || `#${item.itemId}`}</span>
        </span>
      </td>
      <td className="text-right px-2 py-2 whitespace-nowrap">×{item.qty.toLocaleString()}</td>
      <td className="text-right px-2 py-2 whitespace-nowrap">
        {item.limitNum > 0 ? item.limitNum.toLocaleString() : t('event-shop-unlimited', '上限なし')}
      </td>
      <td className="text-right px-4 py-2 whitespace-nowrap">{item.costAmount.toLocaleString()}</td>
    </tr>
  )
}

const CurrencyGroupCard: React.FC<{ group: ShopCurrencyGroup }> = ({ group }) => {
  const { t } = useTranslation('events')
  return (
    <div className="rounded-md flex flex-col" style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}>
      <CurrencyHeader group={group} />
      <table className="w-full text-xs">
        <thead>
          <tr style={{ color: 'var(--text3)' }}>
            <th className="text-left font-medium px-4 py-2">{t('event-shop-col-item', '品目')}</th>
            <th className="text-right font-medium px-2 py-2">{t('event-shop-col-qty', '1回の個数')}</th>
            <th className="text-right font-medium px-2 py-2">{t('event-shop-col-limit', '在庫上限')}</th>
            <th className="text-right font-medium px-4 py-2">{t('event-shop-col-cost', '1回の対価')}</th>
          </tr>
        </thead>
        <tbody>
          {group.items.map((item, i) => (
            <ShopRow key={i} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 交換所の品目を対価の通貨ごとにまとめ、通貨ごとの全交換に要る合計と品目を並べる。 */
export const EventShopList: React.FC<{ shop: EventShopItem[] }> = ({ shop }) => (
  <div className="flex flex-col gap-4">
    {groupShopByCurrency(shop).map(group => (
      <CurrencyGroupCard key={group.costItemId} group={group} />
    ))}
  </div>
)
