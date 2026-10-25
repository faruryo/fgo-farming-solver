'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { useMasterLevel } from '../../hooks/use-master-level'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'
import { MAX_MASTER_LEVEL } from '../../lib/master-profile/max-ap'
import type { ApBudget } from '../../lib/ap-budget'

/** 所持黄金の果実数の localStorage キー（端末ローカル: KEYS 非登録）。 */
const GOLDEN_FRUIT_KEY = STORAGE_KEYS.EVENTS_GOLDEN_FRUIT

/** AP予算に使うマスターレベル（→ 最大AP）と所持黄金の果実数。箱計画と交換所で同じ保存先を読む。 */
export const useApBudgetProfile = () => {
  const { level: masterLevel, setLevel: setMasterLevel, maxAp } = useMasterLevel()
  const [goldenFruitOwned, setGoldenFruitOwned] = useLocalStorage<number>(GOLDEN_FRUIT_KEY, 0)
  return { masterLevel, setMasterLevel, maxAp, goldenFruitOwned, setGoldenFruitOwned }
}

export const StatBlock: React.FC<{ label: string; value: React.ReactNode; sub?: string }> = ({ label, value, sub }) => (
  <div className="flex flex-col gap-0.5">
    <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
      {label}
    </p>
    <p className="text-xl font-bold" style={{ color: 'var(--text1)' }}>
      {value}
    </p>
    {sub && (
      <p className="text-[10px]" style={{ color: 'var(--text3)' }}>
        {sub}
      </p>
    )}
  </div>
)

/** AP予算の入力欄（マスターレベル + 所持黄金の果実）。 */
export const ApBudgetInputs: React.FC = () => {
  const { t } = useTranslation('events')
  const { masterLevel, setMasterLevel, maxAp, goldenFruitOwned, setGoldenFruitOwned } = useApBudgetProfile()
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
    >
      <p className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>
        {t('AP予算')}
      </p>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">
          {t('マスターレベル')}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={MAX_MASTER_LEVEL}
            value={masterLevel}
            onChange={e =>
              setMasterLevel(
                Math.min(MAX_MASTER_LEVEL, Math.max(1, Math.floor(Number(e.target.value)) || 1)),
              )
            }
            aria-label={t('マスターレベル')}
            className="w-24 text-sm"
          />
          <span className="text-xs" style={{ color: 'var(--text3)' }}>
            {t('最大APN', { ap: maxAp })}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">
          {t('所持黄金の果実')}
        </Label>
        <Input
          type="number"
          min={0}
          value={goldenFruitOwned}
          onChange={e => setGoldenFruitOwned(Math.max(0, Math.floor(Number(e.target.value))))}
          aria-label={t('所持黄金の果実')}
          className="w-24 text-sm"
          placeholder="0"
        />
      </div>
      <p className="text-[10px]" style={{ color: 'var(--text3)' }}>
        {t('AP予算入力注記')}
      </p>
    </div>
  )
}

/** AP予算内訳（[回復の回数 →] 黄金の果実 → 聖晶石 → 課金額）。 */
export const ApBudgetBreakdown: React.FC<{ apBudget: ApBudget; showRestores?: boolean }> = ({
  apBudget,
  showRestores = false,
}) => {
  const { t } = useTranslation('events')
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>
          {t('AP予算内訳')}
        </p>
        <Tooltip>
          <TooltipTrigger className="flex-shrink-0 cursor-default" style={{ color: 'var(--text3)' }}>
            <Info size={13} />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[260px] text-left leading-relaxed">
            {t('課金額換算説明')}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className={showRestores ? 'grid grid-cols-2 sm:grid-cols-4 gap-3' : 'grid grid-cols-3 gap-3'}>
        {showRestores && (
          <StatBlock
            label={t('event-ap-restores', '回復の回数')}
            value={apBudget.totalRestores.toLocaleString()}
            sub={t('最大AP基準', '最大AP {{maxAp}} 基準', { maxAp: apBudget.maxAp })}
          />
        )}
        <StatBlock
          label={t('黄金の果実消費', '黄金の果実')}
          value={apBudget.goldenFruitUsed.toLocaleString()}
          sub={t('所持N', '所持 {{count}}', { count: apBudget.goldenFruitOwned })}
        />
        <StatBlock
          label={t('必要聖晶石', '必要聖晶石')}
          value={apBudget.quartzCount.toLocaleString()}
        />
        <StatBlock
          label={t('課金額目安', '課金額目安')}
          value={`¥${apBudget.yen.toLocaleString()}`}
        />
      </div>
    </div>
  )
}
