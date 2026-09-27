'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import type { Quest } from '../../interfaces/fgodrop'
import { QuestIdentity } from '../common/QuestIdentity'
import { questConsumesPod } from '../../lib/quest-consumes-pod'
import type { EntryEstimate } from '../../lib/bond/entry-estimate'
import {
  MAX_CURRENT_BOND_LEVEL,
  MAX_TARGET_BOND_LEVEL,
  type BondInputError,
} from '../../lib/bond/estimate'
import { splitByPlan } from '../../lib/bond/plan'
import type { BondQuestCandidate } from '../../lib/bond/quest-candidates'
import {
  filterQuestCandidates,
  withCurrentLevel,
  withObservedPerRun,
  withObservedTeapotRun,
  type BondTrackerEntry,
} from '../../lib/bond/state'
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

function QuestOption({
  candidate: c,
  rank,
  planned,
}: Readonly<{ candidate: BondQuestCandidate; rank?: number; planned: number | undefined }>) {
  const { t } = useTranslation('bond')
  return (
    <div className="flex w-full min-w-0 items-center gap-2 text-left">
      {rank !== undefined && (
        <span className="w-5 shrink-0 text-right text-[11px] font-bold tabular-nums" style={{ color: 'var(--text3)' }}>
          {rank}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <QuestIdentity
          area={c.quest.area}
          name={c.quest.name}
          ap={c.effectiveAp}
          originalAp={c.quest.ap}
          consumesPod={questConsumesPod(c.quest.area)}
        />
        {(planned || c.unconfirmedClass) && (
          <div className="flex flex-wrap items-center gap-1 pl-10">
            {planned ? <Badge variant="secondary">{t('plan-option', '周回予定 {{count}}周', { count: planned })}</Badge> : null}
            {c.unconfirmedClass && (
              <span className="text-[9px]" style={{ color: 'var(--text3)' }}>{t('unconfirmed-class', '※対象クラス未確認')}</span>
            )}
          </div>
        )}
      </div>
      <span className="shrink-0 text-[13px] font-bold tabular-nums" style={{ color: 'var(--gold)' }}>
        {c.effectiveAp === 0
          ? t('bond-per-ap-free', 'AP消費なし')
          : t('bond-per-ap', '{{rate}}/AP', { rate: ((c.quest.bondPoints as number) / c.effectiveAp).toFixed(1) })}
      </span>
    </div>
  )
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
  const selected = candidates.find(c => c.quest.id === entry.questId)
  const items = filterQuestCandidates(candidates, keyword, entry.questId)
  return (
    <div className="flex flex-col gap-1 text-xs">
      <label htmlFor={id}>{t('quest', '周回クエスト')}</label>
      <Combobox
        items={items}
        filter={null}
        value={items.find(i => i.candidate.quest.id === entry.questId) ?? null}
        isItemEqualToValue={(a, b) => a.candidate.quest.id === b.candidate.quest.id}
        itemToStringLabel={i => questLabel(i.candidate.quest)}
        onValueChange={i => i && onChange({ ...entry, questId: i.candidate.quest.id })}
        inputValue={keyword}
        onInputValueChange={setKeyword}
        onOpenChange={open => !open && setKeyword('')}
      >
        <ComboboxTrigger
          id={id}
          render={<Button variant="outline" className="h-auto w-full justify-between gap-2 py-1.5" />}
        >
          {selected ? (
            <QuestOption candidate={selected} planned={plannedLaps.get(selected.quest.id)} />
          ) : (
            <span style={{ color: 'var(--text3)' }}>{t('quest-placeholder', 'クエストを選択')}</span>
          )}
        </ComboboxTrigger>
        <ComboboxContent className="w-[min(28rem,calc(100vw-2rem))]">
          <ComboboxInput showTrigger={false} placeholder={t('quest-filter', 'クエスト名で絞り込み(効率順)')} />
          <ComboboxEmpty>{t('quest-empty', '該当するクエストがありません')}</ComboboxEmpty>
          <ComboboxList>
            {(i: (typeof items)[number]) => (
              <ComboboxItem key={i.candidate.quest.id} value={i}>
                <QuestOption candidate={i.candidate} rank={i.rank} planned={plannedLaps.get(i.candidate.quest.id)} />
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
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

function BaseNote() {
  const { t } = useTranslation('bond')
  return (
    <p className="text-[11px]" style={{ color: 'var(--text3)' }}>
      {t('base-note', '基礎値(ボーナスなし)で見積もり — 実測値を入れると正確になります')}
    </p>
  )
}

export function ObservedPerRunInput({
  entry,
  questBase,
  remeasure,
  onChange,
}: Readonly<{
  entry: BondTrackerEntry
  questBase: number | undefined
  remeasure: (patch: Partial<BondTrackerEntry>) => void
  onChange: EntryChange
}>) {
  const { t } = useTranslation('bond')
  const id = `bond-${entry.servantId}-observed`
  return (
    <div className="flex flex-col gap-1">
      <CountInput
        id={id}
        label={t('observed-per-run', '1周の獲得絆')}
        placeholder={questBase ? String(questBase) : t('observed-placeholder', 'リザルト画面の値')}
        value={entry.observedPerRun}
        onChange={observedPerRun => remeasure(withObservedPerRun(entry, observedPerRun))}
      />
      {entry.observedPerRun > 0 && (
        <label className="flex items-center gap-2 whitespace-nowrap">
          <Checkbox
            checked={entry.observedTeapotRun}
            onCheckedChange={checked => onChange(withObservedTeapotRun(entry, Boolean(checked)))}
          />
          {t('observed-teapot-run', 'ティーポット使用時の値')}
        </label>
      )}
    </div>
  )
}

function BondStateInputs({
  entry,
  growth,
  questBase,
  onChange,
}: Readonly<{
  entry: BondTrackerEntry
  growth: number[] | undefined
  questBase: number | undefined
  onChange: EntryChange
}>) {
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
        <ObservedPerRunInput entry={entry} questBase={questBase} remeasure={remeasure} onChange={onChange} />
      </div>
      {entry.observedPerRun === 0 && <BaseNote />}
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
      {result.basis === 'converted' && (
        <p className={note} style={{ color: 'var(--text3)' }}>
          {t('estimated-note', '{{quest}}で計測した値を基本絆の比で換算した推定値です', {
            quest: questLabel(result.measuredQuest),
          })}
        </p>
      )}
      {result.basis === 'base' && <BaseNote />}
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
      <BondStateInputs
        entry={entry}
        growth={servant?.bondGrowth}
        questBase={estimate.candidate?.quest.bondPoints}
        onChange={onChange}
      />
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
