'use client'

import { Collapsible } from '@base-ui/react/collapsible'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type CollapsibleSectionProps = {
  id?: string
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  badge?: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  headerActions?: ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
  children: ReactNode
}

const stopHeaderActionEvent = (event: { stopPropagation: () => void }) => {
  event.stopPropagation()
}

const SectionHeader = ({
  title,
  subtitle,
  icon,
  badge,
  headerActions,
  headerClassName,
}: Pick<
  CollapsibleSectionProps,
  'title' | 'subtitle' | 'icon' | 'badge' | 'headerActions' | 'headerClassName'
>) => (
  <div className="flex items-stretch border-b border-transparent group-data-open/collapsible:border-border">
    <Collapsible.Trigger
      className={cn(
        'group/trigger flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--panel2)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        headerClassName,
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
      {badge}
      <ChevronDown
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-aria-expanded/trigger:rotate-180"
      />
    </Collapsible.Trigger>
    {headerActions ? (
      <div
        className="flex items-center pr-2"
        onClick={stopHeaderActionEvent}
        onKeyDown={stopHeaderActionEvent}
      >
        {headerActions}
      </div>
    ) : null}
  </div>
)

export const CollapsibleSection = ({
  id,
  title,
  subtitle,
  icon,
  badge,
  defaultOpen,
  open,
  onOpenChange,
  headerActions,
  className,
  headerClassName,
  contentClassName,
  children,
}: CollapsibleSectionProps) => (
  <Collapsible.Root
    id={id}
    defaultOpen={defaultOpen}
    open={open}
    onOpenChange={(next) => onOpenChange?.(next)}
    className={cn(
      'group/collapsible overflow-hidden rounded-md border border-border bg-[var(--panel)]',
      className,
    )}
  >
    <SectionHeader
      title={title}
      subtitle={subtitle}
      icon={icon}
      badge={badge}
      headerActions={headerActions}
      headerClassName={headerClassName}
    />
    <Collapsible.Panel
      className={cn(
        'overflow-hidden data-closed:animate-accordion-up data-open:animate-accordion-down',
        contentClassName,
      )}
    >
      <div className="p-4">{children}</div>
    </Collapsible.Panel>
  </Collapsible.Root>
)
