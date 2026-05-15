import Image from 'next/image'
import React from 'react'
import type { Item, Materials } from '../../interfaces/atlas-academy'
import { toApiItemId } from '../../lib/to-api-item-id'
import { ItemLink } from '../common/item-link'

export const MaterialList = ({
  materials,
  items,
}: {
  materials: Materials
  items: Item[]
}) => {
  return (
    <div className="flex flex-col gap-8">
      {Object.entries(materials).map(([lv, mats]) => (
        <div className="flex flex-col gap-2" key={lv}>
          <h3 className="text-base font-semibold">
            <span className="font-normal">Lv.</span> {lv}
          </h3>
          <div className="flex flex-wrap gap-3 p-4 rounded-md border" style={{ borderColor: 'var(--border)' }}>
            {mats.items.map(({ item, amount }) => (
              <div key={item.id} className="mx-2">
                <div className="flex items-center gap-2">
                  <Image src={item.icon} alt={item.name} width={32} height={32} />
                  <div className="text-xs" style={{ color: 'var(--text2)' }}>
                    <ItemLink id={toApiItemId(item, items)} name={item.name} />
                  </div>
                </div>
                <div className="font-semibold">{amount}</div>
              </div>
            ))}
            {mats.qp > 0 && (
              <div className="mx-2">
                <div className="text-xs" style={{ color: 'var(--text2)' }}>QP</div>
                <div className="font-semibold">{mats.qp.toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
