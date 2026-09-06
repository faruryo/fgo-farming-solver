'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useFarmingPurpose } from '../../hooks/use-farming-purpose'
import type { FarmingPurpose } from '../../lib/farming-purpose'

const PURPOSES: Array<{
  value: FarmingPurpose
  key: string
  fallback: string
}> = [
  {
    value: 'training',
    key: 'farming-purpose-training',
    fallback: '今の育成を進める',
  },
  {
    value: 'reserve',
    key: 'farming-purpose-reserve',
    fallback: '新規サーヴァントに備える',
  },
  {
    value: 'all',
    key: 'farming-purpose-all',
    fallback: '素材全体の効率を見る',
  },
]

export const FarmingPurposeSelector = ({
  compact = false,
}: {
  compact?: boolean
}) => {
  const { t } = useTranslation('common')
  const { purpose, setPurpose } = useFarmingPurpose()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const current = PURPOSES.find((item) => item.value === purpose) ?? PURPOSES[0]

  if (compact) {
    return (
      <Dialog>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          {t(current.key, current.fallback)}
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <PurposeContent
            purpose={purpose}
            setPurpose={setPurpose}
            onDetails={() => setDetailsOpen(true)}
            t={t}
            variant="dialog"
          />
          <FormulaDialog
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            t={t}
          />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div
      className="px-5 py-4"
      style={{ borderBottom: '1px solid rgba(154,114,36,0.28)' }}
    >
      <PurposeContent
        purpose={purpose}
        setPurpose={setPurpose}
        onDetails={() => setDetailsOpen(true)}
        t={t}
        variant="nav"
      />
      <FormulaDialog open={detailsOpen} onOpenChange={setDetailsOpen} t={t} />
    </div>
  )
}

const NavOptionButton = ({
  isSelected,
  onClick,
  label,
}: {
  isSelected: boolean
  onClick: () => void
  label: string
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={isSelected}
    onClick={onClick}
    className="flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition-colors cursor-pointer"
    style={
      isSelected
        ? {
            borderColor: '#c09030',
            color: '#f6e5be',
            background: 'rgba(154,114,36,0.22)',
            fontWeight: 600,
          }
        : {
            borderColor: 'rgba(154,114,36,0.28)',
            color: 'rgba(255,255,255,0.9)',
            background: 'rgba(255,255,255,0.03)',
          }
    }
    onMouseEnter={(e) => {
      if (!isSelected)
        e.currentTarget.style.background = 'rgba(154,114,36,0.12)'
    }}
    onMouseLeave={(e) => {
      if (!isSelected)
        e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
    }}
  >
    <span>{label}</span>
    {isSelected && (
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ background: '#c09030' }}
      />
    )}
  </button>
)

const DialogOptionButton = ({
  isSelected,
  onClick,
  label,
}: {
  isSelected: boolean
  onClick: () => void
  label: string
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={isSelected}
    onClick={onClick}
    className="flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition-colors cursor-pointer"
    style={
      isSelected
        ? {
            borderColor: 'var(--gold)',
            color: '#7a5410',
            background: 'rgba(154,114,36,0.12)',
            fontWeight: 600,
          }
        : {
            borderColor: 'var(--border2)',
            color: 'var(--text)',
            background: 'transparent',
          }
    }
  >
    <span>{label}</span>
    {isSelected && (
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ background: 'var(--gold)' }}
      />
    )}
  </button>
)

const PurposeOptionButton = ({
  isSelected,
  onClick,
  isNav,
  label,
}: {
  isSelected: boolean
  onClick: () => void
  isNav: boolean
  label: string
}) =>
  isNav ? (
    <NavOptionButton isSelected={isSelected} onClick={onClick} label={label} />
  ) : (
    <DialogOptionButton
      isSelected={isSelected}
      onClick={onClick}
      label={label}
    />
  )

const PurposeContent = ({
  purpose,
  setPurpose,
  onDetails,
  t,
  variant = 'nav',
}: {
  purpose: FarmingPurpose
  setPurpose: (purpose: FarmingPurpose) => void
  onDetails: () => void
  t: (key: string, fallback: string) => string
  variant?: 'nav' | 'dialog'
}) => {
  const isNav = variant === 'nav'

  return (
    <div className="space-y-2.5">
      {isNav ? (
        <div className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#c09030]">
          {t('farming-purpose', '周回目的')}
        </div>
      ) : (
        <p className="text-xs font-semibold">{t('farming-purpose', '周回目的')}</p>
      )}
      <div
        className="grid gap-1.5"
        role="radiogroup"
        aria-label={t('farming-purpose', '周回目的')}
      >
        {PURPOSES.map((item) => (
          <PurposeOptionButton
            key={item.value}
            isSelected={purpose === item.value}
            onClick={() => setPurpose(item.value)}
            isNav={isNav}
            label={t(item.key, item.fallback)}
          />
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          'w-full cursor-pointer gap-1.5 text-xs',
          isNav
            ? 'hover:bg-[rgba(154,114,36,0.15)] hover:text-[#f6e5be]'
            : 'text-muted-foreground hover:text-foreground',
        )}
        style={isNav ? { color: '#c09030' } : undefined}
        onClick={onDetails}
      >
        <Info size={13} className="shrink-0" />
        {t('farming-purpose-formula-link', '計算方法を見る')}
      </Button>
    </div>
  )
}

const FormulaDialog = ({
  open,
  onOpenChange,
  t,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  t: (key: string, fallback: string) => string
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>
          {t('farming-purpose-formula-title', '周回効率ポイントの計算方法')}
        </DialogTitle>
        <DialogDescription>
          {t(
            'farming-purpose-formula-summary',
            '各素材の相対効率に、選んだ周回目的の重みを掛けて合計します。',
          )}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <p>
          {t(
            'farming-purpose-formula-training',
            '今の育成：必要数に足りない素材を、在庫が少ないほど高く評価します。',
          )}
        </p>
        <p>
          {t(
            'farming-purpose-formula-reserve',
            '新規への備え：育成必要数と在庫基準の大きい方まで集めます。',
          )}
        </p>
        <p>
          {t(
            'farming-purpose-formula-all',
            '素材全体：所持数に関係なく、全素材を同じ重みで比較します。',
          )}
        </p>
        <p className="rounded-md bg-muted p-3 font-mono text-xs">
          {t(
            'farming-purpose-formula-low-stock',
            '1 + 在庫基準 ÷ (所持数 + 在庫基準)',
          )}
        </p>
        <p>
          {t(
            'farming-purpose-formula-denominator',
            'AP効率は消費AP、周回効率はターン数で割ります。QP・絆・EXPは設定時だけ加算します。',
          )}
        </p>
      </div>
    </DialogContent>
  </Dialog>
)
