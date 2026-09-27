'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import type { Quest } from '../../interfaces/fgodrop'
import type { EntryEstimate } from '../../lib/bond/entry-estimate'
import {
  MAX_CURRENT_BOND_LEVEL,
  MAX_TARGET_BOND_LEVEL,
  type BondInputError,
} from '../../lib/bond/estimate'
import { apCampaignLabel, splitByPlan } from '../../lib/bond/plan'
import type { BondQuestCandidate } from '../../lib/bond/quest-candidates'
import { filterQuestCandidates, withCurrentLevel, type BondTrackerEntry } from '../../lib/bond/state'
import { getClassName } from '../../lib/class-names'
import { getClassIconUrl } from '../../lib/get-class-icon-url'
import type { MaterialCatalogServant } from '../../lib/material-catalog'

const levels = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

const toCount = (value: string) => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

export const questLabel = (quest: Quest | undefined) => (quest ? `${quest.area} ${quest.name}` : '')

function ErrorMessage({ error }: Readonly<{ error: BondInputError }>) {
  const { t } = useTranslation('bond')
  if (error.kind === 'no-bond-data')
    return <>{t('no-bond-data', '絆データ未取得のため見積もれません')}</>
  if (error.kind === 'remeasure')
    return <>{t('remeasure', '計測したクエストが見つかりません。1周の獲得絆を入れ直してください')}</>
  const field = {
    currentLevel: t('current-level', '現在の絆Lv'),
    targetLevel: t('target-level', '目標の絆Lv'),
    remainingToNext: t('remaining-to-next', '次のLvまで'),
    observedPerRun: t('observed-per-run', '1周の獲得絆'),
  }[error.field]
  return error.max === undefined ? (
    <>{t('range-error-min', '{{field}}が範囲外です({{min}}以上)', { field, min: error.min.toLocaleString() })}</>
  ) : (
    <>
      {t('range-error-between', '{{field}}が範囲外です({{min}}〜{{max}})', {
        field,
        min: error.min.toLocaleString(),
        max: error.max.toLocaleString(),
      })}
    </>
  )
}

function Stat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px]" style={{ color: 'var(--text3)' }}>{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}

export function ClassIcon({ servant, size }: Readonly<{ servant: MaterialCatalogServant; size: number }>) {
  const { i18n } = useTranslation()
  const url = getClassIconUrl(servant.className, servant.rarity)
  const alt = getClassName(servant.className, i18n.language)
  return url ? <Image src={url} alt={alt} title={alt} width={size} height={size} className="shrink-0" /> : null
}

type EntryChange = (entry: BondTrackerEntry) => void

// 候補の後ろに付ける注記(APキャンペーン・周回予定・対象クラス未確認)
const questNotes = (c: BondQuestCandidate, planned: number | undefined, t: TFunction<'bond'>) => {
  const notes: string[] = []
  const campaign = apCampaignLabel(c.quest.ap, c.effectiveAp)
  if (campaign) {
    const label = campaign.fraction
      ? t('ap-campaign-ratio', 'AP{{fraction}}', { fraction: campaign.fraction })
      : t('ap-campaign', 'AP割引')
    notes.push(`${label} ${c.effectiveAp}AP`)
  }
  if (planned) notes.push(t('plan-option', '周回予定 {{count}}周', { count: planned }))
  if (c.unconfirmedClass) notes.push(t('unconfirmed-class', '※対象クラス未確認'))
  return notes.map(note => ` ${note}`).join('')
}

function QuestSelect({
  entry,
  candidates,
  plannedLaps,
  onChange,
}: Readonly<{
  entry: BondTrackerEntry
  candidates: BondQuestCandidate[]
  plannedLaps: ReadonlyMap<string, number>
  onChange: EntryChange
}>) {
  const { t } = useTranslation('bond')
  const [keyword, setKeyword] = useState('')
  const id = `bond-${entry.servantId}-quest`
  return (
    <div className="flex flex-col gap-1 text-xs">
      <label htmlFor={id}>{t('quest', '周回クエスト')}</label>
      <Input
        type="search"
        value={keyword}
        onChange={e => setKeyword(e.target.value)}
        placeholder={t('quest-filter', 'クエスト名で絞り込み(効率順)')}
        aria-label={t('quest-filter', 'クエスト名で絞り込み(効率順)')}
        aria-controls={id}
      />
      <select
        id={id}
        className="c-global-dd w-full text-left"
        value={entry.questId}
        onChange={e => onChange({ ...entry, questId: e.target.value })}
      >
        {filterQuestCandidates(candidates, keyword, entry.questId).map(({ candidate: c, rank }) => (
          <option key={c.quest.id} value={c.quest.id}>
            {rank}. {questLabel(c.quest)} ({t('bond-per-ap-rate', '絆{{bond}} / {{ap}}AP = {{rate}}/AP', {
              bond: c.quest.bondPoints,
              ap: c.effectiveAp,
              rate: ((c.quest.bondPoints as number) / c.effectiveAp).toFixed(1),
            })})
            {questNotes(c, plannedLaps.get(c.quest.id), t)}
          </option>
        ))}
      </select>
    </div>
  )
}

function LevelSelect({
  id,
  label,
  value,
  from,
  to,
  onChange,
}: Readonly<{ id: string; label: string; value: number; from: number; to: number; onChange: (level: number) => void }>) {
  return (
    <label className="flex flex-col gap-1" htmlFor={id}>
      {label}
      <select id={id} className="c-global-dd" value={value} onChange={e => onChange(Number(e.target.value))}>
        {levels(from, to).map(level => (
          <option key={level} value={level}>{level}</option>
        ))}
      </select>
    </label>
  )
}

function CountInput({
  id,
  label,
  value,
  placeholder,
  onChange,
}: Readonly<{ id: string; label: string; value: number; placeholder?: string; onChange: (value: number) => void }>) {
  return (
    <label className="flex flex-col gap-1" htmlFor={id}>
      {label}
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        placeholder={placeholder}
        value={value || ''}
        onChange={e => onChange(toCount(e.target.value))}
      />
    </label>
  )
}

function BondStateInputs({
  entry,
  growth,
  onChange,
}: Readonly<{ entry: BondTrackerEntry; growth: number[] | undefined; onChange: EntryChange }>) {
  const { t } = useTranslation('bond')
  const id = (field: string) => `bond-${entry.servantId}-${field}`
  // 獲得絆を入れ直したら、その時点の周回クエストを計測クエストにする
  const remeasure = (patch: Partial<BondTrackerEntry>) => onChange({ ...entry, ...patch, measuredQuestId: entry.questId })
  return (
    <>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <LevelSelect
          id={id('current')}
          label={t('current-level', '現在の絆Lv')}
          value={entry.currentLevel}
          from={0}
          to={MAX_CURRENT_BOND_LEVEL}
          onChange={currentLevel => onChange(withCurrentLevel(entry, currentLevel, growth))}
        />
        <CountInput
          id={id('remaining')}
          label={t('remaining-to-next', '次のLvまで')}
          value={entry.remainingToNext}
          onChange={remainingToNext => onChange({ ...entry, remainingToNext })}
        />
        <LevelSelect
          id={id('target')}
          label={t('target-level', '目標の絆Lv')}
          value={entry.targetLevel}
          from={entry.currentLevel + 1}
          to={MAX_TARGET_BOND_LEVEL}
          onChange={targetLevel => onChange({ ...entry, targetLevel })}
        />
        <CountInput
          id={id('observed')}
          label={t('observed-per-run', '1周の獲得絆')}
          placeholder={t('observed-placeholder', 'リザルト画面の値')}
          value={entry.observedPerRun}
          onChange={observedPerRun => remeasure({ observedPerRun })}
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={entry.observedTeapotRun}
          onCheckedChange={checked => remeasure({ observedTeapotRun: Boolean(checked) })}
        />
        {t('observed-teapot-run', 'ティーポットを使った周回の値')}
      </label>
    </>
  )
}

function EstimateResult({
  result,
  teapotEnabled,
  planned,
}: Readonly<{ result: NonNullable<EntryEstimate['result']>; teapotEnabled: boolean; planned: number | undefined }>) {
  const { t } = useTranslation('bond')
  const plan = splitByPlan({ ...result.runs, perRun: result.perRun, remaining: result.remaining }, planned)
  const note = 'text-[11px]'
  return (
    <div className="flex flex-col gap-2" data-testid="bond-estimate">
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        <Stat label={t('remaining-bond', '残り絆')} value={result.remaining.toLocaleString()} />
        <Stat
          label={result.estimated ? t('per-run-estimated', '1周の獲得絆(推定)') : t('per-run', '1周の獲得絆')}
          value={result.perRun.toLocaleString()}
        />
        <Stat label={t('remaining-runs', '残り周回')} value={t('runs-count', '{{count}}周', { count: result.runs.runs })} />
        <Stat label={t('required-ap', '必要AP')} value={result.ap.toLocaleString()} />
        {result.pods > 0 && (
          <Stat label={t('storm-pods', 'ストームポッド')} value={t('pods-count', '{{count}}個', { count: result.pods })} />
        )}
      </div>
      {plan && (
        <p className="text-xs" data-testid="bond-plan">
          {plan.achieved
            ? t('plan-achieved', '周回予定 {{planned}}周の予定内で達成', { planned: plan.planned })
            : t('plan-split', '予定内 {{inPlan}}周(絆{{bond}}) / 予定超過 {{over}}周', {
                inPlan: plan.inPlanRuns,
                bond: plan.inPlanBond.toLocaleString(),
                over: plan.overRuns,
              })}
        </p>
      )}
      {result.estimated && (
        <p className={note} style={{ color: 'var(--text3)' }}>
          {t('estimated-note', '{{quest}}で計測した値を基本絆の比で換算した推定値です', {
            quest: questLabel(result.measuredQuest),
          })}
        </p>
      )}
      {teapotEnabled && (
        <p className={note} style={{ color: 'var(--text3)' }}>
          {t('teapot-saving', 'ティーポット{{teapot}}個使用で{{saved}}周短縮', {
            teapot: result.runs.teapotRuns,
            saved: result.runs.runsWithoutTeapot - result.runs.runs,
          })}
        </p>
      )}
    </div>
  )
}

export function BondServantCard({
  servant,
  estimate,
  candidates,
  teapotEnabled,
  plannedLaps,
  onChange,
  onRemove,
}: Readonly<{
  servant: MaterialCatalogServant | undefined
  estimate: EntryEstimate
  candidates: BondQuestCandidate[]
  teapotEnabled: boolean
  plannedLaps: ReadonlyMap<string, number>
  onChange: EntryChange
  onRemove: () => void
}>) {
  const { t } = useTranslation('bond')
  const { entry, result, errors } = estimate
  const name = servant?.name ?? `#${entry.servantId}`
  return (
    <div className="c-card flex flex-col gap-3 p-3" data-testid={`bond-card-${entry.servantId}`}>
      <div className="flex items-center gap-3">
        {servant?.face ? <Image src={servant.face} alt={name} width={48} height={48} className="rounded" /> : null}
        <div className="flex min-w-0 flex-1 items-center gap-1 font-semibold">
          {servant && <ClassIcon servant={servant} size={20} />}
          {name}
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          {t('remove', '削除')}
        </Button>
      </div>
      <QuestSelect entry={entry} candidates={candidates} plannedLaps={plannedLaps} onChange={onChange} />
      <BondStateInputs entry={entry} growth={servant?.bondGrowth} onChange={onChange} />
      {errors.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs" role="alert" style={{ color: 'var(--red, #c0392b)' }}>
          {errors.map(error => (
            <li key={error.kind === 'range' ? error.field : error.kind}>
              <ErrorMessage error={error} />
            </li>
          ))}
        </ul>
      )}
      {result && <EstimateResult result={result} teapotEnabled={teapotEnabled} planned={plannedLaps.get(entry.questId)} />}
    </div>
  )
}
