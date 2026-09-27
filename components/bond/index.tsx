'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMaterialCatalog } from '../../hooks/use-material-catalog'
import type { BondTrackerState } from '../../lib/bond/state'
import type { MaterialCatalogServant } from '../../lib/material-catalog'
import { BondEstimateTable } from './estimate-table'
import { BondServantCard, ClassIcon } from './servant-card'
import { useBondTracker } from './use-bond-tracker'

const SEARCH_LIMIT = 20

function TeapotSettings({
  teapot,
  onChange,
}: Readonly<{ teapot: BondTrackerState['teapot']; onChange: (teapot: Partial<BondTrackerState['teapot']>) => void }>) {
  const { t } = useTranslation('bond')
  return (
    <div className="c-card flex flex-col gap-2 p-3 text-sm">
      <label className="flex items-center justify-between gap-3">
        <span>{t('teapot-enabled', 'ティーポットを使う')}</span>
        <Switch
          checked={teapot.enabled}
          onCheckedChange={enabled => onChange({ enabled })}
          aria-label={t('teapot-enabled', 'ティーポットを使う')}
        />
      </label>
      {teapot.enabled && (
        <>
          <label className="flex items-center justify-between gap-3" htmlFor="bond-teapot-stock">
            <span>{t('teapot-stock', 'ティーポット所持数')}</span>
            <Input
              id="bond-teapot-stock"
              type="number"
              inputMode="numeric"
              min={0}
              className="w-24"
              value={teapot.stock || ''}
              onChange={e => onChange({ stock: Math.max(0, Math.floor(Number(e.target.value)) || 0) })}
            />
          </label>
          <p className="text-[11px]" style={{ color: 'var(--text3)' }}>
            {t('teapot-note', '所持数はクエストごとに全数を充てて見積もります')}
          </p>
        </>
      )}
    </div>
  )
}

function ServantSearch({
  servants,
  registered,
  onAdd,
}: Readonly<{ servants: MaterialCatalogServant[]; registered: Set<number>; onAdd: (servant: MaterialCatalogServant) => void }>) {
  const { t } = useTranslation('bond')
  const [query, setQuery] = useState('')
  const keyword = query.trim()
  const matches = keyword ? servants.filter(s => s.name.includes(keyword)).slice(0, SEARCH_LIMIT) : []
  return (
    <div className="flex flex-col gap-1">
      <Input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={t('search-servant', 'サーヴァント名で検索して追加')}
        aria-label={t('search-servant', 'サーヴァント名で検索して追加')}
      />
      {matches.length > 0 && (
        <ul className="c-card flex max-h-64 flex-col overflow-y-auto p-1 text-sm">
          {matches.map(s => (
            <li key={s.id}>
              <button
                type="button"
                className="flex w-full justify-between gap-2 rounded px-2 py-1 text-left hover:bg-muted disabled:opacity-50"
                disabled={registered.has(s.id)}
                onClick={() => {
                  onAdd(s)
                  setQuery('')
                }}
              >
                <span className="flex items-center gap-1">
                  <ClassIcon servant={s} size={18} />
                  {s.name}
                </span>
                {registered.has(s.id) && <span className="text-xs">{t('registered', '登録済み')}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function BondTrackerBody({ servants }: Readonly<{ servants: MaterialCatalogServant[] }>) {
  const { t } = useTranslation('bond')
  const tracker = useBondTracker(servants)
  if (tracker.isLoading) return <p>{t('loading', '読み込んでいます…')}</p>
  return (
    <div className="flex flex-col gap-4">
      <TeapotSettings teapot={tracker.state.teapot} onChange={tracker.setTeapot} />
      <Tabs defaultValue="input">
        <TabsList>
          <TabsTrigger value="input">{t('tab-input', '入力')}</TabsTrigger>
          <TabsTrigger value="estimate">{t('tab-estimate', '見積もり')}</TabsTrigger>
        </TabsList>
        <TabsContent value="input" className="flex flex-col gap-3">
          <ServantSearch
            servants={servants}
            registered={new Set(tracker.state.entries.map(e => e.servantId))}
            onAdd={tracker.addServant}
          />
          {tracker.cards.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text3)' }}>
              {t('empty', '絆を上げたいサーヴァントを追加してください')}
            </p>
          )}
          {tracker.cards.map(({ servant, candidates, estimate }) => (
            <BondServantCard
              key={estimate.entry.servantId}
              servant={servant}
              candidates={candidates}
              estimate={estimate}
              teapotEnabled={tracker.state.teapot.enabled}
              plannedLaps={tracker.plannedLaps}
              onChange={tracker.updateEntry}
              onRemove={() => tracker.removeEntry(estimate.entry.servantId)}
            />
          ))}
        </TabsContent>
        <TabsContent value="estimate">
          <BondEstimateTable summary={tracker.summary} cards={tracker.cards} questsById={tracker.questsById} plannedLaps={tracker.plannedLaps} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function BondTracker() {
  const { t } = useTranslation('bond')
  const { catalog, failed, reload } = useMaterialCatalog()
  if (failed)
    return (
      <div className="flex flex-col items-start gap-2">
        <p>{t('catalog-load-error', 'サーヴァントデータを読み込めません。')}</p>
        <Button variant="outline" onClick={reload}>{t('catalog-retry', '再試行')}</Button>
      </div>
    )
  if (!catalog) return <p>{t('loading', '読み込んでいます…')}</p>
  return <BondTrackerBody servants={catalog.servants} />
}
