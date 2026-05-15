import Image from 'next/image'
import { getItemIconUrl } from '../../lib/get-item-icon-url'
import { Link } from './link'

export const ItemLink = ({ id, name, icon }: { id: string; name: string; icon?: string }) => (
  <span className="inline-flex items-center gap-2">
    {icon && (
      <Image
        src={getItemIconUrl(icon)}
        alt={name}
        width={24}
        height={24}
        style={{ objectFit: 'contain' }}
      />
    )}
    <Link href={`/items/${id}`}>
      {name}
    </Link>
  </span>
)
