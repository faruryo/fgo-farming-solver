'use client'

import Image from 'next/image'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useMasterLevel } from '../../hooks/use-master-level'
import {
  adviseBondCraftEssences,
  type CraftEssenceAdvice,
  type CraftEssenceAssignment,
} from '../../lib/bond/craft-essence-advice'
import type { BondQuestCandidate } from '../../lib/bond/quest-candidates'
import { defaultSharedBondQuestId, sharedBondQuestCandidates } from '../../lib/bond/shared-quest-candidates'
import { MAX_MASTER_LEVEL } from '../../lib/master-profile/max-ap'
import { maxCostForLevel } from '../../lib/master-profile/max-cost'
import type { MaterialCatalogBondUpCraftEssence, MaterialCatalogServant } from '../../lib/material-catalog'
import { ClassIcon, questLabel } from './servant-card'

/** 編成できる自分のサーヴァントの数(フレンドのサポートを除く)。 */
export const MAX_ADVISOR_SERVANTS = 5

export type AdvisorServant = {
  servant: MaterialCatalogServant
  candidates: BondQuestCandidate[]
  /** 絆トラッカーで選んでいる周回クエスト。 */
  questId: string
}

/** 絆トラッカーのカードを登録順のまま提案の入力に変える。カタログにないサーヴァントは除く。 */
export const advisorServants = (
  cards: readonly { servant: MaterialCatalogServant | undefined; candidates: BondQuestCandidate[]; estimate: { entry: { questId: string } } }[],
): AdvisorServant[] =>
  cards.flatMap(({ servant, candidates, estimate }) => (servant ? [{ servant, candidates, questId: estimate.entry.questId }] : []))

const Note = ({ children, alert = false }: Readonly<{ children: ReactNode; alert?: boolean }>) => (
  <p className="text-sm" role={alert ? 'alert' : undefined} style={{ color: alert ? 'var(--red, #c0392b)' : 'var(--text3)' }}>
    {children}
  </p>
)

function ServantPicker({
  registered,
  selected,
  onToggle,
}: Readonly<{ registered: AdvisorServant[]; selected: number[]; onToggle: (id: number) => void }>) {
  const { t } = useTranslation('bond')
  const full = selected.length >= MAX_ADVISOR_SERVANTS
  return (
    <fieldset className="flex flex-col gap-1 text-sm">
      <legend className="mb-1">
        {t('advisor-servants', 'サーヴァント(最大{{max}}体)', { max: MAX_ADVISOR_SERVANTS })}
      </legend>
      {registered.map(({ servant }) => {
        const checked = selected.includes(servant.id)
        return (
          <label key={servant.id} className="flex w-fit items-center gap-2">
            <Checkbox
              checked={checked}
              disabled={!checked && full}
              onCheckedChange={() => onToggle(servant.id)}
            />
            {servant.face ? <Image src={servant.face} alt="" width={28} height={28} className="rounded" /> : null}
            <ClassIcon servant={servant} size={18} />
            {servant.name}
          </label>
        )
      })}
    </fieldset>
  )
}

function MasterLevelInput() {
  const { t } = useTranslation('bond')
  const { level, setLevel } = useMasterLevel()
  return (
    <label className="flex w-fit items-center gap-3 text-sm" htmlFor="bond-advisor-master-level">
      <span>{t('advisor-master-level', 'マスターレベル')}</span>
      <Input
        id="bond-advisor-master-level"
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_MASTER_LEVEL}
        className="w-24"
        value={level}
        onChange={e => {
          const value = Math.floor(Number(e.target.value))
          if (Number.isFinite(value) && value >= 1) setLevel(Math.min(MAX_MASTER_LEVEL, value))
        }}
      />
    </label>
  )
}

const EssenceFace = ({ essence, size }: Readonly<{ essence: MaterialCatalogBondUpCraftEssence; size: number }>) => (
  <Image src={essence.face} alt="" width={size} height={size} className="rounded" />
)

const STAGE_NAMES = ['第1再臨', '第2再臨', '第3再臨', '最終再臨']

const useStageName = () => {
  const { t } = useTranslation('bond')
  return (stage: number) => t(`advisor-stage-${stage}`, STAGE_NAMES.at(stage) ?? '')
}

/** 効く相手と効果。「〔キャスター〕に +20%」「全員に +50」「自身に +50」。 */
function EssenceEffect({ essence }: Readonly<{ essence: MaterialCatalogBondUpCraftEssence }>) {
  const { t } = useTranslation('bond')
  const parts =
    essence.target === 'self'
      ? [t('advisor-effect-self', '自身に +{{add}}', { add: essence.add })]
      : effectParts(essence, essence.appliesToLabel ?? t('advisor-everyone', '全員'), t)
  return <span style={{ color: 'var(--text3)' }}>{parts.join(' ')}</span>
}

const effectParts = (
  essence: MaterialCatalogBondUpCraftEssence,
  target: string,
  t: ReturnType<typeof useTranslation>['t'],
): string[] => [
  ...(essence.rate > 0 ? [t('advisor-effect-rate', '{{target}}に +{{rate}}%', { target, rate: essence.rate / 10 })] : []),
  ...(essence.add > 0 ? [t('advisor-effect-add', '{{target}}に +{{add}}', { target, add: essence.add })] : []),
]

function AssignmentRow({
  assignment: { servantId, essence, alternatives, points, countedStage, stageNotes },
  nameOf,
}: Readonly<{ assignment: CraftEssenceAssignment; nameOf: (id: number) => string }>) {
  const { t } = useTranslation('bond')
  const stageName = useStageName()
  return (
    <li className="c-card flex flex-col gap-1 p-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{nameOf(servantId)}</span>
        <span className="flex flex-wrap items-center gap-2">
          {countedStage !== null && (
            <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
              {t('advisor-counted-stage', '{{stage}}で数えた', { stage: stageName(countedStage) })}
            </span>
          )}
          {t('advisor-points', '1周 {{points}}', { points: points.toLocaleString() })}
        </span>
      </div>
      {essence ? (
        <span className="flex flex-wrap items-center gap-2">
          <EssenceFace essence={essence} size={32} />
          {essence.name}
          <EssenceEffect essence={essence} />
        </span>
      ) : (
        <span style={{ color: 'var(--text3)' }}>{t('advisor-no-essence', '礼装なし')}</span>
      )}
      {stageNotes.map(note => (
        <span key={note.servantId} className="text-[11px]" style={{ color: 'var(--text3)' }}>
          {t('advisor-stage-applies', '{{name}}は{{stages}}で効く', {
            name: nameOf(note.servantId),
            stages: note.stages.map(stageName).join('・'),
          })}
        </span>
      ))}
      {alternatives.length > 0 && (
        <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
          {t('advisor-alternatives', '同じ効果: {{names}}', { names: alternatives.map(e => e.name).join('、') })}
        </span>
      )}
    </li>
  )
}

function AdviceResult({
  advice,
  servantsById,
}: Readonly<{ advice: CraftEssenceAdvice; servantsById: ReadonlyMap<number, MaterialCatalogServant> }>) {
  const { t } = useTranslation('bond')
  const nameOf = (id: number) => servantsById.get(id)?.name ?? `#${id}`
  if (advice.kind === 'unknownCost')
    return (
      <Note alert>
        {t('advisor-unknown-cost', '{{names}}のコストが分からないため提案できません', {
          names: advice.servantIds.map(nameOf).join('、'),
        })}
      </Note>
    )
  if (advice.kind === 'overCost')
    return (
      <Note alert>
        {t(
          'advisor-over-cost',
          'サーヴァントのコストの合計{{cost}}が上限{{max}}を超えています。マスターレベルを上げるか、選ぶサーヴァントを減らしてください',
          { cost: advice.servantCost, max: advice.maxCost },
        )}
      </Note>
    )
  return (
    <div className="flex flex-col gap-2" data-testid="bond-advisor-result">
      <ul className="flex flex-col gap-2">
        {advice.assignments.map(assignment => (
          <AssignmentRow key={assignment.servantId} assignment={assignment} nameOf={nameOf} />
        ))}
      </ul>
      <AdviceTotals advice={advice} />
    </div>
  )
}

function AdviceTotals({ advice }: Readonly<{ advice: Extract<CraftEssenceAdvice, { kind: 'ok' }> }>) {
  const { t } = useTranslation('bond')
  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt>{t('advisor-total', '1周の獲得絆の合計')}</dt>
        <dd className="font-semibold">{advice.total.toLocaleString()}</dd>
        <dt>{t('advisor-base-total', '礼装なしの合計')}</dt>
        <dd>{advice.baseTotal.toLocaleString()}</dd>
        <dt>{t('advisor-cost', 'コスト')}</dt>
        <dd>{t('advisor-cost-value', '{{used}} / {{max}}', { used: advice.usedCost, max: advice.maxCost })}</dd>
      </dl>
      <p className="text-[11px]" style={{ color: 'var(--text3)' }}>
        {t('advisor-note', '周回クエストの基本絆ポイントと最大解放時の効果から求めた推定値です。所持している礼装かどうかは見ていません')}
      </p>
    </>
  )
}

function QuestAdvice({
  selected,
  essences,
}: Readonly<{ selected: AdvisorServant[]; essences: MaterialCatalogBondUpCraftEssence[] }>) {
  const { t } = useTranslation('bond')
  const { level } = useMasterLevel()
  const [chosenQuestId, setChosenQuestId] = useState<string | null>(null)
  const shared = sharedBondQuestCandidates(selected.map(s => s.candidates))
  const questId = shared.some(c => c.quest.id === chosenQuestId)
    ? chosenQuestId
    : defaultSharedBondQuestId(shared, selected[0]?.questId)
  const quest = shared.find(c => c.quest.id === questId)?.quest
  const servantsById = new Map(selected.map(s => [s.servant.id, s.servant]))
  if (!shared.length)
    return <Note alert>{t('advisor-no-shared-quest', '選んだサーヴァントで一緒に回せるクエストがありません')}</Note>
  const advice = quest
    ? adviseBondCraftEssences({
        servants: selected.map(({ servant }) => ({
          id: servant.id,
          cost: servant.cost,
          traits: servant.traits,
          ascensionTraits: servant.ascensionTraits,
        })),
        basePoints: quest.bondPoints as number,
        maxCost: maxCostForLevel(level),
        essences,
      })
    : null
  return (
    <>
      <label className="flex flex-col gap-1 text-sm" htmlFor="bond-advisor-quest">
        {t('quest', '周回クエスト')}
        <select
          id="bond-advisor-quest"
          className="c-global-dd"
          value={questId ?? ''}
          onChange={e => setChosenQuestId(e.target.value)}
        >
          {!quest && <option value="">{t('quest-placeholder', 'クエストを選択')}</option>}
          {shared.map(c => (
            <option key={c.quest.id} value={c.quest.id}>
              {questLabel(c.quest)}
              {c.unconfirmedClass ? ` ${t('unconfirmed-class', '※対象クラス未確認')}` : ''}
            </option>
          ))}
        </select>
      </label>
      {advice && <AdviceResult advice={advice} servantsById={servantsById} />}
    </>
  )
}

export function CraftEssenceAdvisor({
  registered,
  essences,
}: Readonly<{ registered: AdvisorServant[]; essences: MaterialCatalogBondUpCraftEssence[] | undefined }>) {
  const { t } = useTranslation('bond')
  // 選択は保存しない。触るまでは登録順の先頭から最大5体。
  const [chosenIds, setChosenIds] = useState<number[] | null>(null)
  const registeredIds = registered.map(r => r.servant.id)
  const selectedIds = (chosenIds ?? registeredIds.slice(0, MAX_ADVISOR_SERVANTS)).filter(id => registeredIds.includes(id))
  const selected = registered.filter(r => selectedIds.includes(r.servant.id))
  const toggle = (id: number) => {
    if (selectedIds.includes(id)) setChosenIds(selectedIds.filter(s => s !== id))
    else if (selectedIds.length < MAX_ADVISOR_SERVANTS) setChosenIds([...selectedIds, id])
  }
  // 効く相手の条件を持たない礼装(条件を足す前のカタログ)は、誰に効くか分からないので候補にしない。
  const usable = essences?.filter(essence => essence.appliesTo !== undefined) ?? []
  if (!usable.length)
    return <Note alert>{t('advisor-no-essence-data', '礼装のデータを読み込めないため提案できません')}</Note>
  return (
    <div className="flex flex-col gap-3" data-testid="bond-craft-essence-advisor">
      <p className="text-sm" style={{ color: 'var(--text3)' }}>
        {t('advisor-description', '選んだサーヴァントの1周の獲得絆の合計が最も大きくなる絆アップ礼装の組み合わせを提案します')}
      </p>
      <ServantPicker registered={registered} selected={selectedIds} onToggle={toggle} />
      <MasterLevelInput />
      {selected.length === 0 ? (
        <Note alert>{t('advisor-no-servant', '提案するサーヴァントを選んでください')}</Note>
      ) : (
        <QuestAdvice selected={selected} essences={usable} />
      )}
    </div>
  )
}
