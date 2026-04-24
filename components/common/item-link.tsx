import { HStack } from '@chakra-ui/react'
import { Link } from './link'

const itemColors: { [key: string]: string } = {
  0: 'item.bronze',
  1: 'item.silver',
  2: 'item.gold',
  3: 'item.blue',
  4: 'item.red',
  5: 'item.gold',
  6: 'item.silver',
  7: 'item.gold',
}

import { getItemIconUrl } from '../../lib/get-item-icon-url'

export const ItemLink = ({ id, name, icon }: { id: string; name: string; icon?: string }) => (
  <HStack spacing={2} display="inline-flex" align="center">
    {icon && (
      <img
        src={getItemIconUrl(icon)}
        alt={name}
        style={{ width: '24px', height: '24px', objectFit: 'contain' }}
      />
    )}
    <Link href={`/items/${id}`} color={itemColors[id[0]]}>
      {name}
    </Link>
  </HStack>
)
