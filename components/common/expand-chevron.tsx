import { ChevronDown } from 'lucide-react'
import React from 'react'

export const ExpandChevronIcon = ({
  expanded,
  className,
  ...props
}: React.ComponentPropsWithoutRef<'svg'> & { expanded?: boolean }) => (
  <ChevronDown
    size={20}
    color="gray"
    style={{ transform: `rotate(${expanded ? '0deg' : '-90deg'})` }}
    className={className}
    {...props}
  />
)
