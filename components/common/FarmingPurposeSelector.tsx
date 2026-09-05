'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
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
      />
      <FormulaDialog open={detailsOpen} onOpenChange={setDetailsOpen} t={t} />
    </div>
  )
}

const PurposeContent = ({
  purpose,
  setPurpose,
  onDetails,
  t,
}: {
  purpose: FarmingPurpose
  setPurpose: (purpose: FarmingPurpose) => void
  onDetails: () => void
  t: (key: string, fallback: string) => string
}) => (
  <div className="space-y-2">
    <p className="text-xs font-semibold">{t('farming-purpose', '周回目的')}</p>
    <div
      className="grid gap-1"
      role="radiogroup"
      aria-label={t('farming-purpose', '周回目的')}
    >
      {PURPOSES.map((item) => (
        <button
          key={item.value}
          type="button"
          role="radio"
          aria-checked={purpose === item.value}
          onClick={() => setPurpose(item.value)}
          className="rounded-md border px-3 py-2 text-left text-xs transition-colors"
          style={
            purpose === item.value
              ? {
                  borderColor: 'var(--gold)',
                  color: 'var(--gold)',
                  background: 'var(--accent)',
                }
              : { borderColor: 'var(--border)', color: 'var(--text2)' }
          }
        >
          {t(item.key, item.fallback)}
        </button>
      ))}
    </div>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="w-full"
      onClick={onDetails}
    >
      <Info size={13} />
      {t('farming-purpose-formula-link', '計算方法を見る')}
    </Button>
  </div>
)

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
          1 + 在庫基準 ÷ (所持数 + 在庫基準)
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
