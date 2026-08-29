'use client'

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ItemIdentity } from '../../common/ItemIdentity'
import { analyzeScreenshot } from '../../../lib/possession-import/analyze-screenshot'
import { mergeCandidates } from '../../../lib/possession-import/merge-candidates'
import { MatchTarget } from '../../../lib/possession-import/fuzzy-match'
import { MergedCandidate } from '../../../lib/possession-import/types'
import { parsePossessionInput } from '../../../lib/possession-count'
import {
  countBySection,
  isReviewRowVisible,
  reviewSection,
  sortReviewRows,
  toReviewRow,
  type ReviewFilter,
  type ReviewRow,
  type ReviewSection,
} from '../../../lib/possession-import/review-presentation'
import { cn } from '@/lib/utils'

type ItemLike = {
  id: string
  name: string
  icon?: string
  atlasId?: number
}

type Stage = 'upload' | 'analyzing' | 'review'

const isReviewFilter = (v: unknown): v is ReviewFilter =>
  v === 'all' || v === 'changed' || v === 'needs-review'

const parsedProposedFromRaw = (raw: string | undefined): number | null => {
  const parsed = parsePossessionInput(raw ?? '')
  return parsed === undefined ? null : parsed
}

const ReviewSectionHeader: React.FC<{
  section: ReviewSection
  unchangedCount: number
  unchangedExpanded: boolean
  onToggleUnchanged: () => void
}> = ({ section, unchangedCount, unchangedExpanded, onToggleUnchanged }) => {
  const { t } = useTranslation('quests')
  if (section === 'unchanged') {
    return (
      <button
        type="button"
        className="flex items-center gap-1 text-xs font-semibold mt-3 mb-1 first:mt-0"
        style={{ color: 'var(--text2)' }}
        onClick={onToggleUnchanged}
        aria-expanded={unchangedExpanded}
        data-testid={`import-review-section-${section}`}
      >
        {unchangedExpanded ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
        {t('import-review-section-unchanged', '変更なし')} ({unchangedCount})
      </button>
    )
  }
  let heading = t('import-review-section-decrease', '減少')
  if (section === 'needs-review') heading = t('import-review-section-needs-review', '要確認')
  else if (section === 'increase') heading = t('import-review-section-increase', '増加')
  return (
    <h3
      className="text-xs font-semibold mt-3 mb-1 first:mt-0"
      style={{ color: 'var(--text2)' }}
      data-testid={`import-review-section-${section}`}
    >
      {heading}
    </h3>
  )
}

const ReviewRowSurface: React.FC<{
  section: ReviewSection
  changeClass: ReviewRow['changeClass']
  atlasId: number
  children: React.ReactNode
}> = ({ section, changeClass, atlasId, children }) => (
  <div
    data-review-row
    data-review-section={section}
    data-change-class={changeClass}
    data-atlas-id={atlasId}
    className={cn(
      'relative flex flex-wrap items-center gap-2 py-2 pl-3',
      section === 'increase' && 'bg-teal-600/10 dark:bg-teal-400/15',
      section === 'decrease' && 'bg-orange-500/10 dark:bg-orange-400/15',
      section === 'unchanged' && 'opacity-60'
    )}
    style={
      section === 'needs-review'
        ? { background: 'var(--warning-bg, rgba(234,179,8,0.08))' }
        : undefined
    }
  >
    {section === 'increase' && (
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-teal-600" />
    )}
    {section === 'decrease' && (
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, rgb(249 115 22) 0 4px, transparent 4px 8px)',
        }}
      />
    )}
    {children}
  </div>
)

const ReviewCandidateRow: React.FC<{
  row: ReviewRow
  candidate: MergedCandidate
  item: ItemLike | undefined
  isExcluded: boolean
  editedValue: string
  cropOpen: boolean
  onToggleExcluded: (checked: boolean) => void
  onEdit: (raw: string) => void
  onToggleCrop: () => void
  onFocusInput: () => void
  onBlurInput: () => void
}> = ({
  row,
  candidate,
  item,
  isExcluded,
  editedValue,
  cropOpen,
  onToggleExcluded,
  onEdit,
  onToggleCrop,
  onFocusInput,
  onBlurInput,
}) => {
  const { t } = useTranslation('quests')
  const showSign = row.changeClass === 'increase' || row.changeClass === 'decrease'
  const absDelta = Math.abs(row.delta ?? 0)

  return (
    <ReviewRowSurface section={row.section} changeClass={row.changeClass} atlasId={row.atlasId}>
      <Checkbox checked={!isExcluded} onCheckedChange={(checked) => onToggleExcluded(!!checked)} />
      <ItemIdentity icon={item?.icon} name={row.name} size={26} />
      <span className="flex-1 text-xs truncate" title={row.name} style={{ color: 'var(--text1)' }}>
        {row.name}
      </span>
      {showSign && (
        <span
          data-testid="import-review-sign-badge"
          className={cn(
            'text-[10px] px-1.5 py-0.5 rounded font-semibold tabular-nums',
            row.changeClass === 'increase' && 'text-teal-800 bg-teal-600/15 dark:text-teal-200',
            row.changeClass === 'decrease' && 'text-orange-800 bg-orange-500/15 dark:text-orange-200'
          )}
          aria-label={
            row.changeClass === 'increase'
              ? t('import-review-increase-badge', '{{count}}個増加', { count: absDelta })
              : t('import-review-decrease-badge', '{{count}}個減少', { count: absDelta })
          }
        >
          {row.changeClass === 'increase' ? `+${absDelta}` : `-${absDelta}`}
        </span>
      )}
      {candidate.hasConflict && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{ color: '#d97706', background: 'rgba(217,119,6,0.12)' }}
        >
          {t('矛盾あり')}
        </span>
      )}
      {candidate.needsReview && !candidate.hasConflict && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{ color: '#d97706', background: 'rgba(217,119,6,0.12)' }}
        >
          {t('要確認')}
        </span>
      )}
      <span className="text-xs tabular-nums" style={{ color: 'var(--text2)' }}>
        {candidate.currentQuantity}
      </span>
      <span className="text-xs" style={{ color: 'var(--text2)' }}>
        →
      </span>
      <Input
        type="number"
        min={0}
        className="w-24 h-8 text-right"
        placeholder="-"
        value={editedValue}
        onChange={(e) => onEdit(e.target.value)}
        onFocus={onFocusInput}
        onBlur={onBlurInput}
      />
      {candidate.needsReview && (
        <Button variant="ghost" size="sm" onClick={onToggleCrop}>
          {t('元画像を確認')}
        </Button>
      )}
      {candidate.needsReview && cropOpen && (
        <div className="basis-full flex flex-wrap gap-2 pl-8 pb-2">
          {candidate.sources.map((s, i) => (
            <img
              key={i}
              src={s.cropDataUrl}
              alt={row.name}
              className="border rounded"
              style={{ borderColor: 'var(--border)', maxHeight: 80 }}
            />
          ))}
        </div>
      )}
    </ReviewRowSurface>
  )
}

export const PossessionImportDialog: React.FC<{
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ItemLike[]
  possession: Record<string, number | undefined>
  onConfirm: (updates: Record<string, number>) => void
}> = ({ open, onOpenChange, items, possession, onConfirm }) => {
  const { t } = useTranslation('quests')
  const [stage, setStage] = useState<Stage>('upload')
  const [files, setFiles] = useState<File[]>([])
  const [skippedNames, setSkippedNames] = useState<string[]>([])
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [candidates, setCandidates] = useState<MergedCandidate[]>([])
  const [editedValues, setEditedValues] = useState<Record<number, string>>({})
  const [excluded, setExcluded] = useState<Record<number, boolean>>({})
  const [expandedCrop, setExpandedCrop] = useState<Record<number, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [unchangedExpanded, setUnchangedExpanded] = useState(false)
  const [editingAtlasId, setEditingAtlasId] = useState<number | null>(null)

  const itemsByAtlasId = useMemo(() => {
    const map = new Map<number, ItemLike>()
    for (const it of items) {
      if (it.atlasId != null) map.set(it.atlasId, it)
    }
    return map
  }, [items])

  const matchTargets: MatchTarget[] = useMemo(
    () =>
      [...itemsByAtlasId.entries()].map(([atlasId, it]) => ({
        atlasId,
        name: it.name,
      })),
    [itemsByAtlasId]
  )

  const reset = () => {
    setStage('upload')
    setFiles([])
    setSkippedNames([])
    setCandidates([])
    setEditedValues({})
    setExcluded({})
    setExpandedCrop({})
    setError(null)
    setFilter('all')
    setUnchangedExpanded(false)
    setEditingAtlasId(null)
  }

  const handleClose = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming)
    const images = arr.filter((f) => f.type.startsWith('image/'))
    const rejected = arr.filter((f) => !f.type.startsWith('image/'))
    if (rejected.length > 0) {
      setSkippedNames((prev) => [...prev, ...rejected.map((f) => f.name)])
    }
    setFiles((prev) => [...prev, ...images])
  }

  const runAnalysis = async () => {
    setStage('analyzing')
    setError(null)
    try {
      const currentPossession: Record<number, number | undefined> = {}
      for (const [key, value] of Object.entries(possession)) {
        const n = Number(key)
        if (Number.isFinite(n)) currentPossession[n] = value
      }
      const nameById = new Map<number, string>()
      for (const [atlasId, it] of itemsByAtlasId) nameById.set(atlasId, it.name)

      const allCardCandidates = []
      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length })
        const perImage = await analyzeScreenshot(files[i], i, matchTargets)
        allCardCandidates.push(...perImage)
      }

      const merged = mergeCandidates(allCardCandidates, currentPossession, nameById)
      const initialEdited: Record<number, string> = {}
      for (const c of merged) {
        initialEdited[c.atlasId] = c.proposedQuantity != null ? String(c.proposedQuantity) : ''
      }
      setCandidates(merged)
      setEditedValues(initialEdited)
      setFilter('all')
      setUnchangedExpanded(false)
      setStage('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStage('upload')
    }
  }

  const handleConfirm = () => {
    const updates: Record<number, number> = {}
    for (const c of candidates) {
      if (excluded[c.atlasId]) continue
      const raw = editedValues[c.atlasId]
      if (raw === undefined) continue
      const n = parsePossessionInput(raw)
      if (n !== undefined) updates[c.atlasId] = n
    }
    onConfirm(updates)
    handleClose(false)
  }

  const reviewRows = useMemo(() => {
    const rows = candidates.map((c) =>
      toReviewRow({
        atlasId: c.atlasId,
        name: c.name,
        currentQuantity: c.currentQuantity,
        parsedProposed: parsedProposedFromRaw(editedValues[c.atlasId]),
        needsReview: c.needsReview,
        hasConflict: c.hasConflict,
      })
    )
    return sortReviewRows(rows)
  }, [candidates, editedValues])

  const sectionCounts = useMemo(() => countBySection(reviewRows), [reviewRows])
  const visibleRows = useMemo(
    () =>
      reviewRows.filter((row) =>
        isReviewRowVisible(row.section, filter, row.atlasId, editingAtlasId)
      ),
    [reviewRows, filter, editingAtlasId]
  )
  const candidateById = useMemo(() => {
    const map = new Map<number, MergedCandidate>()
    for (const c of candidates) map.set(c.atlasId, c)
    return map
  }, [candidates])

  const applyEditedValue = (candidate: MergedCandidate, raw: string) => {
    setEditedValues((prev) => ({ ...prev, [candidate.atlasId]: raw }))
    const nextSection = reviewSection({
      atlasId: candidate.atlasId,
      name: candidate.name,
      currentQuantity: candidate.currentQuantity,
      parsedProposed: parsedProposedFromRaw(raw),
      needsReview: candidate.needsReview,
      hasConflict: candidate.hasConflict,
    })
    if (nextSection === 'unchanged') setUnchangedExpanded(true)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto gap-5">
        <DialogHeader>
          <DialogTitle>{t('スクリーンショットから所持数を取り込む')}</DialogTitle>
          <DialogDescription>{t('スクリーンショット取り込み説明')}</DialogDescription>
        </DialogHeader>

        {stage === 'upload' && (
          <div className="flex flex-col gap-3">
            <div
              className="border border-dashed rounded-lg p-6 text-center text-sm"
              style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                addFiles(e.dataTransfer.files)
              }}
            >
              <p className="mb-3">{t('ここに画像をドラッグ&ドロップ、または')}</p>
              <label className="inline-block">
                <span className="inline-flex items-center h-8 px-3 rounded-lg border cursor-pointer text-sm" style={{ borderColor: 'var(--border)' }}>
                  {t('画像を選択')}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>

            {files.length > 0 && (
              <ul className="text-xs" style={{ color: 'var(--text2)' }}>
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`}>{f.name}</li>
                ))}
              </ul>
            )}
            {skippedNames.length > 0 && (
              <p className="text-xs" style={{ color: 'var(--destructive, #d33)' }}>
                {t('対応外ファイルを除外しました')}: {skippedNames.join(', ')}
              </p>
            )}
            {error && (
              <p className="text-xs" style={{ color: 'var(--destructive, #d33)' }}>
                {error}
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                {t('キャンセル')}
              </Button>
              <Button disabled={files.length === 0} onClick={runAnalysis}>
                {t('解析する')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {stage === 'analyzing' && (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <div
              className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--border)', borderTopColor: 'transparent' }}
            />
            <p className="text-sm" style={{ color: 'var(--text2)' }}>
              {t('解析中')} ({progress.current}/{progress.total})
            </p>
          </div>
        )}

        {stage === 'review' && (
          <div className="flex flex-col gap-3">
            {candidates.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--text2)' }}>
                {t('認識できたアイテムがありません')}
              </p>
            ) : (
              <>
                <div
                  className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums"
                  style={{ color: 'var(--text2)' }}
                  data-testid="import-review-summary"
                >
                  <span data-testid="import-review-count-needs-review">
                    {t('import-review-summary-needs-review', '要確認 {{count}}', {
                      count: sectionCounts['needs-review'],
                    })}
                  </span>
                  <span data-testid="import-review-count-increase">
                    {t('import-review-summary-increase', '増加 {{count}}', {
                      count: sectionCounts.increase,
                    })}
                  </span>
                  <span data-testid="import-review-count-decrease">
                    {t('import-review-summary-decrease', '減少 {{count}}', {
                      count: sectionCounts.decrease,
                    })}
                  </span>
                  <span data-testid="import-review-count-unchanged">
                    {t('import-review-summary-unchanged', '変更なし {{count}}', {
                      count: sectionCounts.unchanged,
                    })}
                  </span>
                </div>
                <ToggleGroup
                  value={[filter]}
                  onValueChange={(values: string[]) => {
                    const next = values[0]
                    if (isReviewFilter(next)) setFilter(next)
                  }}
                  size="sm"
                  spacing={0}
                  aria-label={t('import-review-filter-label', '表示フィルタ')}
                  className="rounded-md overflow-hidden"
                  style={{ boxShadow: 'inset 0 0 0 1px var(--border)' }}
                >
                  <ToggleGroupItem value="all" className="h-7 px-3 rounded-none! text-[10px] font-semibold">
                    {t('import-review-filter-all', 'すべて')}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="changed" className="h-7 px-3 rounded-none! text-[10px] font-semibold">
                    {t('import-review-filter-changed', '変更あり')}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="needs-review"
                    className="h-7 px-3 rounded-none! text-[10px] font-semibold"
                  >
                    {t('import-review-filter-needs-review', '要確認')}
                  </ToggleGroupItem>
                </ToggleGroup>
                <div className="flex flex-col" style={{ borderColor: 'var(--border)' }}>
                  {visibleRows.map((row, index) => {
                    const prev = visibleRows[index - 1]
                    const showHeader = row.section !== prev?.section
                    const hideUnchangedRow =
                      row.section === 'unchanged' && !unchangedExpanded && row.atlasId !== editingAtlasId
                    const c = candidateById.get(row.atlasId)
                    return (
                      <React.Fragment key={row.atlasId}>
                        {showHeader && (
                          <ReviewSectionHeader
                            section={row.section}
                            unchangedCount={sectionCounts.unchanged}
                            unchangedExpanded={unchangedExpanded}
                            onToggleUnchanged={() => setUnchangedExpanded((open) => !open)}
                          />
                        )}
                        {!hideUnchangedRow && c && (
                          <ReviewCandidateRow
                            row={row}
                            candidate={c}
                            item={itemsByAtlasId.get(row.atlasId)}
                            isExcluded={!!excluded[row.atlasId]}
                            editedValue={editedValues[row.atlasId] ?? ''}
                            cropOpen={!!expandedCrop[row.atlasId]}
                            onToggleExcluded={(checked) =>
                              setExcluded((prev) => ({ ...prev, [row.atlasId]: !checked }))
                            }
                            onEdit={(raw) => applyEditedValue(c, raw)}
                            onToggleCrop={() =>
                              setExpandedCrop((prev) => ({
                                ...prev,
                                [row.atlasId]: !prev[row.atlasId],
                              }))
                            }
                            onFocusInput={() => setEditingAtlasId(row.atlasId)}
                            onBlurInput={() =>
                              setEditingAtlasId((id) => (id === row.atlasId ? null : id))
                            }
                          />
                        )}
                      </React.Fragment>
                    )
                  })}
                </div>
              </>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                {t('キャンセル')}
              </Button>
              <Button disabled={candidates.length === 0} onClick={handleConfirm}>
                {t('反映する')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
