/* eslint-disable */
import {
  chakra,
  Heading,
  Stat,
  StatGroup,
  StatLabel,
  StatNumber,
  VStack,
} from '@chakra-ui/react'
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
    <VStack align="stretch" spacing={8}>
      {Object.entries(materials).map(([lv, materials]) => (
        <VStack align="stretch" key={lv}>
          <Heading size="md">
            <chakra.span fontWeight="normal">Lv.</chakra.span> {lv}
          </Heading>
          <StatGroup borderWidth="thin" borderRadius="md" p={2}>
            {materials.items.map(({ item, amount }) => (
              <Stat key={item.id} mx={2}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img src={item.icon} alt={item.name} style={{ width: '32px', height: '32px' }} />
                  <StatLabel>
                    <ItemLink id={toApiItemId(item, items)} name={item.name} />
                  </StatLabel>
                </div>
                <StatNumber>{amount}</StatNumber>
              </Stat>
            ))}
            {materials.qp > 0 && (
              <Stat mx={2}>
                <StatLabel>QP</StatLabel>
                <StatNumber>{materials.qp.toLocaleString()}</StatNumber>
              </Stat>
            )}
          </StatGroup>
        </VStack>
      ))}
    </VStack>
  )
}
