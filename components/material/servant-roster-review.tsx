'use client'

import React, { useMemo, useState } from 'react'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { NumberField } from '@/components/ui/number-field'
import type { ChaldeaState } from '../../hooks/create-chaldea-state'
import type { MaterialCatalogServant } from '../../lib/material-catalog'
import type { ServantLevel, ServantLevelImportRow, ServantLevels } from '../../lib/servant-levels'
import type { ReviewReason, RosterImportResult, RosterRow, ValueRange } from '../../lib/servant-roster-import/types'
import { ClassIcon } from '../bond/servant-card'
import { countNewlyOwned } from '../../lib/servant-roster-owned'
import {
  applyRowEdit,
  importRows,
  initialRowEdit,
  isRowDecided,
  isRowIncluded,
  levelFieldRange,
  overlappingServants,
  readLevelField,
  type LevelField,
  type RosterRowEdit,
} from '../../lib/servant-roster-review'

type DoneResult = Extract<RosterImportResult, { kind: 'done' }>
type ServantById = ReadonlyMap<number, MaterialCatalogServant>

/** 名前で絞り込んだときに並べるサーヴァントの数の上限 */
const PICKER_LIMIT = 30

const SmallIcon: React.FC<{ src?: string | null; alt: string; size?: number }> = ({ src, alt, size = 24 }) =>
  src ? (
    <Image src={src} alt={alt} title={alt} width={size} height={size} unoptimized className="object-contain flex-shrink-0 rounded" />
  ) : null

const useReasonText = () => {
  const { t } = useTranslation('material')
  const texts: Record<ReviewReason, string> = {
    'ambiguous-face': t('roster-import-reason-ambiguous-face', '顔の差が小さい'),
    'unknown-face': t('roster-import-reason-unknown-face', 'どのサーヴァントにも近くない'),
    'out-of-range': t('roster-import-reason-out-of-range', '値が範囲に無い'),
    'rarity-mismatch': t('roster-import-reason-rarity-mismatch', 'Lv の上限がレア度に合わない'),
    'sort-order': t('roster-import-reason-sort-order', '並び順に合わない'),
    'lower-than-saved': t('roster-import-reason-lower-than-saved', '前に取り込んだ値より低い'),
  }
  const byReason = new Map(Object.entries(texts))
  return (reasons: readonly ReviewReason[]): string =>
    reasons.map(reason => byReason.get(reason) ?? '').filter(Boolean).join(t('list-separator', '、'))
}

const useRangeText = () => {
  const { t } = useTranslation('material')
  return (range: ValueRange | null): string | null => {
    if (!range) return null
    if (range.min !== undefined && range.max !== undefined) {
      return t('roster-import-range', '{{min}}〜{{max}} のはず', { min: range.min, max: range.max })
    }
    if (range.min !== undefined) return t('roster-import-range-min', '{{min}} 以上のはず', { min: range.min })
    if (range.max !== undefined) return t('roster-import-range-max', '{{max}} 以下のはず', { max: range.max })
    return null
  }
}

const matchesName = (servant: MaterialCatalogServant, query: string): boolean =>
  servant.name.toLowerCase().includes(query.trim().toLowerCase())

/** サーヴァントを選ぶ欄。開くと名前で絞り込める一覧を出す（近い候補を先に並べる） */
const ServantPicker: React.FC<{
  servants: readonly MaterialCatalogServant[]
  byId: ServantById
  value: number | null
  candidates: readonly number[]
  onChange: (id: number) => void
}> = ({ servants, byId, value, candidates, onChange }) => {
  const { t } = useTranslation('material')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const current = value === null ? undefined : byId.get(value)
  const options = useMemo(() => {
    if (!open) return []
    const front = query.trim() === '' ? candidates.flatMap(id => byId.get(id) ?? []) : []
    const rest = servants.filter(s => !front.includes(s) && matchesName(s, query))
    return [...front, ...rest].slice(0, PICKER_LIMIT)
  }, [open, query, candidates, byId, servants])
  const choose = (id: number) => {
    onChange(id)
    setOpen(false)
    setQuery('')
  }
  return (
    // 名前が長くても切り抜きの横に残るよう、名前の段とボタンの段を縦に積む（#308）
    <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
      <span className="flex items-center gap-1">
        <SmallIcon src={current?.face} alt={current?.name ?? ''} />
        {current && <ClassIcon servant={current} size={18} />}
        <span style={{ color: 'var(--text1)' }}>
          {current?.name ?? t('roster-import-no-servant', 'サーヴァントを選んでいません')}
        </span>
      </span>
      <Button size="xs" variant="outline" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        {t('roster-import-choose-servant', 'サーヴァントを選ぶ')}
      </Button>
      {open && (
        <span className="flex w-full flex-col gap-1">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label={t('roster-import-servant-filter', '名前で絞り込む')}
            placeholder={t('roster-import-servant-filter', '名前で絞り込む')}
            className="h-7 text-xs"
          />
          <span className="flex flex-wrap gap-1">
            {options.map(s => (
              <Button key={s.id} size="xs" variant="outline" onClick={() => choose(s.id)}>
                <ClassIcon servant={s} size={16} />
                {s.name}
              </Button>
            ))}
          </span>
        </span>
      )}
    </span>
  )
}

/** Lv か宝具Lv の欄。今保存されている値、入れる値、候補（押すと欄に入る）、推定した範囲を並べる */
const LevelInput: React.FC<{
  field: LevelField
  name: string
  value: number | null
  stored?: number
  candidates: readonly number[]
  range: ValueRange | null
  onChange: (value: number | null) => void
}> = ({ field, name, value, stored, candidates, range, onChange }) => {
  const { t } = useTranslation('material')
  const rangeText = useRangeText()(range)
  const isLv = field === 'lv'
  const label = isLv ? t('roster-import-lv', 'Lv') : t('roster-import-np-lv', '宝具Lv')
  const invalid = readLevelField(field, value).kind === 'invalid'
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span>{label}</span>
      <span className="tabular-nums">{stored ?? '—'}</span>
      <span aria-hidden="true">→</span>
      <span className="block h-7 w-16">
        <NumberField
          {...levelFieldRange(field)}
          value={value}
          onValueChange={next => onChange(next)}
          aria-label={t('roster-import-value-label', '{{name}} の {{label}}', { name, label })}
          aria-invalid={invalid || undefined}
          className="h-[133.333%] w-[133.333%] origin-top-left scale-75 px-2 text-base md:text-base"
        />
      </span>
      {candidates.map(candidate => (
        <Button key={candidate} size="xs" variant="outline" onClick={() => onChange(candidate)}>
          {candidate}
        </Button>
      ))}
      {rangeText && <span>{rangeText}</span>}
      {invalid && (
        <span style={{ color: 'var(--red)' }}>
          {isLv
            ? t('roster-import-lv-invalid', 'Lv は 1〜120 の整数で入れてください')
            : t('roster-import-np-lv-invalid', '宝具Lv は 1〜5 の整数で入れてください')}
        </span>
      )}
    </span>
  )
}

/** 確かめの画面の1行（当てた行か「要確認」の行） */
const RosterReviewRow: React.FC<{
  row: RosterRow
  edit: RosterRowEdit
  servants: readonly MaterialCatalogServant[]
  byId: ServantById
  stored?: ServantLevel
  overlap: boolean
  onChange: (patch: Partial<RosterRowEdit>) => void
}> = ({ row, edit, servants, byId, stored, overlap, onChange }) => {
  const { t } = useTranslation('material')
  const reasonText = useReasonText()
  const review = row.review
  const name = (edit.servantId === null ? undefined : byId.get(edit.servantId)?.name) ?? t('roster-import-no-servant', 'サーヴァントを選んでいません')
  return (
    <li
      data-testid="roster-import-row"
      className="flex flex-col gap-1 py-2 text-xs"
      style={{ borderTop: '1px solid var(--border)', color: 'var(--text2)' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Checkbox
          checked={isRowIncluded(row, edit)}
          disabled={!isRowDecided(row, edit)}
          onCheckedChange={checked => onChange({ included: !!checked })}
          aria-label={t('roster-import-include', '{{name}} を取り込みに入れる', { name })}
        />
        <SmallIcon src={row.crop} alt={t('roster-import-crop', '元の画像のカード')} size={40} />
        <ServantPicker
          servants={servants}
          byId={byId}
          value={edit.servantId}
          candidates={review?.servantCandidates ?? []}
          onChange={servantId => onChange({ servantId })}
        />
        {review && <span className="basis-full" style={{ color: '#d97706' }}>{reasonText(review.reasons)}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <LevelInput
          field="lv"
          name={name}
          value={edit.lv}
          stored={stored?.lv}
          candidates={review?.lvCandidates ?? []}
          range={review?.lvRange ?? null}
          onChange={lv => onChange({ lv })}
        />
        <LevelInput
          field="npLv"
          name={name}
          value={edit.npLv}
          stored={stored?.npLv}
          candidates={review?.npLvCandidates ?? []}
          range={review?.npLvRange ?? null}
          onChange={npLv => onChange({ npLv })}
        />
      </div>
      {overlap && <p style={{ color: 'var(--red)' }}>{t('roster-import-overlap-row', 'ほかの行と同じサーヴァントに決まっています')}</p>}
    </li>
  )
}

/** 読み取りのまとめ（読んだ枚数・当てた数・要確認の数・新しく所持になる数・読めなかった画像・撮り漏れ） */
const RosterSummary: React.FC<{ result: DoneResult; matched: number; review: number; newlyOwned: number }> = ({
  result,
  matched,
  review,
  newlyOwned,
}) => {
  const { t } = useTranslation('material')
  return (
    <div className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text2)' }} data-testid="roster-import-summary">
      <p className="flex flex-wrap gap-x-3 tabular-nums" style={{ color: 'var(--text1)' }}>
        <span>{t('roster-import-summary-images', '{{count}}枚を読みました', { count: result.imageCount })}</span>
        <span>{t('roster-import-summary-rows', '読み取れた {{matched}} 騎 / 要確認 {{review}} 件', { matched, review })}</span>
        <span>{t('roster-import-summary-newly-owned', '新しく所持になる {{count}} 騎', { count: newlyOwned })}</span>
      </p>
      {newlyOwned > 0 && (
        <p>
          {t('roster-import-newly-owned-note', '（確定すると、育成計算機で {{count}} 騎が所持になり、必要な素材の合計に入る）', {
            count: newlyOwned,
          })}
        </p>
      )}
      {result.unreadableImages.length > 0 && (
        <p style={{ color: 'var(--red)' }}>
          {t('roster-import-unreadable', '読めなかった画像: {{count}}枚（{{names}}）', {
            count: result.unreadableImages.length,
            names: result.unreadableImages.join(t('list-separator', '、')),
          })}
        </p>
      )}
      {result.unsortedImageCount > 0 && (
        <p>
          {t('roster-import-unsorted', '並びを読めなかった画像: {{count}}枚（この画像は並び順の検査をしていません）', {
            count: result.unsortedImageCount,
          })}
        </p>
      )}
      {result.shortfall && (
        <p style={{ color: 'var(--red)' }}>
          {t('roster-import-shortfall', '所持サーヴァント {{owned}} のうち {{read}} 枚を読みました。撮り漏れがないか確かめてください', {
            owned: result.shortfall.owned,
            read: result.shortfall.read,
          })}
        </p>
      )}
    </div>
  )
}

type ReviewProps = {
  result: DoneResult
  servants: readonly MaterialCatalogServant[]
  levels: ServantLevels
  chaldeaState: ChaldeaState
  onCancel: () => void
  onConfirm: (rows: ServantLevelImportRow[]) => void
}

/** 行の並び（「要確認」を先に）と、行ごとの入力の状態 */
const useRosterReview = (result: DoneResult, chaldeaState: ChaldeaState) => {
  const [edits, setEdits] = useState<RosterRowEdit[]>(() => result.rows.map(initialRowEdit))
  const indices = result.rows.map((_, index) => index)
  const reviewIndices = indices.filter(i => result.rows.at(i)?.review)
  const matchedIndices = indices.filter(i => !result.rows.at(i)?.review)
  const overlaps = overlappingServants(result.rows, edits)
  const rows = importRows(result.rows, edits)
  const update = (index: number, patch: Partial<RosterRowEdit>) =>
    setEdits(prev =>
      prev.map((edit, k) => {
        const row = result.rows.at(k)
        return k === index && row ? applyRowEdit(row, edit, patch) : edit
      }),
    )
  return {
    edits,
    update,
    reviewIndices,
    matchedIndices,
    overlaps,
    rows,
    newlyOwned: countNewlyOwned(chaldeaState, rows.map(r => r.id)),
  }
}

/** 当てた行の一覧。行が数百になるので、初めは畳んで件数だけを出す */
const MatchedSection: React.FC<{ count: number; children: () => React.ReactNode }> = ({ count, children }) => {
  const { t } = useTranslation('material')
  const [open, setOpen] = useState(false)
  if (count === 0) return null
  return (
    <section className="flex flex-col">
      <button
        type="button"
        className="flex items-center gap-1 text-xs font-semibold"
        style={{ color: 'var(--text1)' }}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
        {t('roster-import-matched-heading', '読み取れたサーヴァント（{{count}}）', { count })}
      </button>
      {open && <ul>{children()}</ul>}
    </section>
  )
}

/** 確かめの段。「要確認」の行を先にまとめ、当てた行は畳んで件数を出す。重なりがあれば確定させない */
export const RosterReviewStage: React.FC<ReviewProps> = ({ result, servants, levels, chaldeaState, onCancel, onConfirm }) => {
  const { t } = useTranslation('material')
  const byId = useMemo(() => new Map(servants.map(s => [s.id, s])), [servants])
  const storedById = useMemo(() => new Map(Object.entries(levels)), [levels])
  const review = useRosterReview(result, chaldeaState)
  const renderRow = (index: number) => {
    const row = result.rows.at(index)
    const edit = review.edits.at(index)
    if (!row || !edit) return null
    return (
      <RosterReviewRow
        key={row.key}
        row={row}
        edit={edit}
        servants={servants}
        byId={byId}
        stored={edit.servantId === null ? undefined : storedById.get(String(edit.servantId))}
        overlap={edit.servantId !== null && isRowIncluded(row, edit) && review.overlaps.has(edit.servantId)}
        onChange={patch => review.update(index, patch)}
      />
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <RosterSummary
        result={result}
        matched={review.matchedIndices.length}
        review={review.reviewIndices.length}
        newlyOwned={review.newlyOwned}
      />
      {result.rows.length === 0 && (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--text2)' }}>
          {t('roster-import-empty', '読み取れたサーヴァントがありません')}
        </p>
      )}
      {review.reviewIndices.length > 0 && (
        <section className="flex flex-col">
          <h3 className="text-xs font-semibold" style={{ color: 'var(--text1)' }}>
            {t('roster-import-review-heading', '要確認（{{count}}）', { count: review.reviewIndices.length })}
          </h3>
          <ul>{review.reviewIndices.map(renderRow)}</ul>
        </section>
      )}
      <MatchedSection count={review.matchedIndices.length}>{() => review.matchedIndices.map(renderRow)}</MatchedSection>
      {review.overlaps.size > 0 && (
        <p className="text-xs" style={{ color: 'var(--red)' }}>
          {t('roster-import-overlap', '同じサーヴァントに決まっている行が2つ以上あるため、確定できません')}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {t('roster-import-close', '閉じる')}
        </Button>
        <Button disabled={review.overlaps.size > 0 || review.rows.length === 0} onClick={() => onConfirm(review.rows)}>
          {t('roster-import-confirm', '確定する')}
        </Button>
      </DialogFooter>
    </div>
  )
}
