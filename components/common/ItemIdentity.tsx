import React from 'react'
import Image from 'next/image'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { getItemIconUrl } from '../../lib/get-item-icon-url'

type Props = {
  icon?: string
  name: string
  size?: number  // アイコンサイズ（デフォルト32px）
  className?: string
}

export const ItemIdentity: React.FC<Props> = ({ icon, name, size = 32, className }) => (
  <Tooltip>
    <TooltipTrigger className={`flex items-center ${className ?? ''}`}>
      <div style={{ width: size, height: size }} className="flex-shrink-0">
        {icon && (
          <Image
            src={getItemIconUrl(icon)}
            alt={name}
            width={size}
            height={size}
            className="object-contain w-full h-full"
          />
        )}
      </div>
    </TooltipTrigger>
    <TooltipContent side="top">{name}</TooltipContent>
  </Tooltip>
)
