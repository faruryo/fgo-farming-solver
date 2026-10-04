'use client'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '../common/link'
import { Button } from '@/components/ui/button'
import { FarmingPurposeSelector } from '../common/FarmingPurposeSelector'
import { EventCraftAdvisor } from '../material/event-craft-advisor'
import { useRosterNeed, toAmounts, type RosterNeed } from '../../hooks/use-roster-need'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { useDrops } from '../../hooks/use-drops'
import { useStockTarget } from '../../hooks/use-stock-target'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'
import { buildNeedByApiItemId } from '../../lib/quest-efficiency'
import { findMissingCraftData, positiveNeedAtlasIds } from '../../lib/event-craft-data-check'
import type { EnrichedItem } from '../../lib/get-items'

interface Props {
  items: EnrichedItem[]
}

type BlockedView = 'empty' | 'roster-error' | 'loading' | 'drops-error' | 'data-missing'

const resolveBlockedView = (
  roster: RosterNeed['status'],
  dropsLoading: boolean,
  dropsEmpty: boolean,
  hasFullNeed: boolean,
): BlockedView | null => {
  if (roster === 'empty') return 'empty'
  if (roster === 'error') return 'roster-error'
  if (roster === 'loading' || dropsLoading) return 'loading'
  if (dropsEmpty) return 'drops-error'
  return hasFullNeed ? null : 'data-missing'
}

const Notice: React.FC<{ error?: boolean; children: React.ReactNode }> = ({ error, children }) => (
  <div
    className="rounded-lg p-4 flex flex-col gap-3 text-sm"
    style={{
      background: 'var(--panel2)',
      border: '1px solid var(--border)',
      color: error ? 'var(--red)' : 'var(--text3)',
    }}
  >
    {children}
  </div>
)

const BlockedNotice: React.FC<{ view: BlockedView }> = ({ view }) => {
  const { t } = useTranslation('events')
  if (view === 'empty') {
    return (
      <Notice>
        <p>{t('event-craft-roster-empty', '育成対象のサーヴァントを設定すると、不足素材から料理の配分を計算できます。')}</p>
        <Link href="/material" className="self-start font-semibold" style={{ color: 'var(--gold)' }}>
          {t('event-craft-roster-link', '育成対象を設定する')}
        </Link>
      </Notice>
    )
  }
  if (view === 'roster-error') return <Notice error>{t('素材データ取得失敗')}</Notice>
  if (view === 'loading') return <Notice>{t('event-craft-loading', 'データを読み込み中...')}</Notice>
  return (
    <Notice error>
      <p>
        {view === 'drops-error'
          ? t('event-craft-drops-error', 'ドロップデータを取得できませんでした。再読み込みしてください。')
          : t(
              'event-craft-data-missing',
              '不足素材の一部でドロップデータが欠けているため、周回数を正しく計算できません。時間をおいて再読み込みしてください。',
            )}
      </p>
      <Button size="sm" variant="outline" className="self-start" onClick={() => window.location.reload()}>
        {t('event-craft-reload', '再読み込み')}
      </Button>
    </Notice>
  )
}

/** 料理作成アドバイザーを永続ロスター由来の need（実所持数 `posession` 基準）で動かす。 */
export const EventCraftSection: React.FC<Props> = ({ items }) => {
  const { t } = useTranslation('events')
  const rosterNeed = useRosterNeed()
  // 周回目標(STORAGE_KEYS.ITEMS)ではなく、/material/result と同じ実所持数を使う。
  const [possession] = useLocalStorage<Record<string, number | undefined>>(
    STORAGE_KEYS.POSSESSION,
    {},
    { lazyWrite: true },
  )
  const drops = useDrops()
  const { purpose, stockEnabled, stockBuffer } = useStockTarget()
  const finitePurpose = purpose === 'reserve' ? 'reserve' : 'training'

  // useDrops は fetch 失敗時も空データで isLoading=false になるため、空は取得失敗として扱う。
  const dropsEmpty =
    drops.items.length === 0 || drops.quests.length === 0 || drops.drop_rates.length === 0

  const fullNeed = useMemo(() => {
    if (rosterNeed.status !== 'ready' || drops.isLoading || dropsEmpty) return null
    const amounts = toAmounts(rosterNeed.totalNeed)
    const needIds = positiveNeedAtlasIds(items, amounts, possession, stockBuffer, finitePurpose)
    if (findMissingCraftData(drops, needIds, items).length > 0) return null
    return buildNeedByApiItemId(amounts, possession, drops, stockBuffer, finitePurpose)
  }, [rosterNeed, drops, dropsEmpty, items, possession, stockBuffer, finitePurpose])

  const blocked = resolveBlockedView(rosterNeed.status, drops.isLoading, dropsEmpty, !!fullNeed)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs" style={{ color: 'var(--text3)' }}>
        {t('event-craft-section-description', '育成ロスターの不足（必要数 − 所持数）で計算します。')}
      </p>
      {blocked || !fullNeed ? (
        <BlockedNotice view={blocked ?? 'data-missing'} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <FarmingPurposeSelector compact />
            {purpose === 'all' && (
              <span style={{ color: 'var(--text3)', fontSize: 11 }}>
                {t('common:farming-purpose-advisor-fallback', '配布評価は今の育成を使用')}
              </span>
            )}
          </div>
          <EventCraftAdvisor items={items} fullNeed={fullNeed} stockEnabled={stockEnabled} />
        </>
      )}
    </div>
  )
}
