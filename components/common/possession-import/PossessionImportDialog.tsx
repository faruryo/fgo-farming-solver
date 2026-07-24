'use client'

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { ItemIdentity } from '../../common/ItemIdentity'
import { analyzeScreenshot } from '../../../lib/possession-import/analyze-screenshot'
import { mergeCandidates } from '../../../lib/possession-import/merge-candidates'
import { MatchTarget } from '../../../lib/possession-import/fuzzy-match'
import { MergedCandidate } from '../../../lib/possession-import/types'
import { parsePossessionInput } from '../../../lib/possession-count'

type ItemLike = {
  id: string
  name: string
  icon?: string
  atlasId?: number
}

type Stage = 'upload' | 'analyzing' | 'review'

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
    onConfirm(updates as Record<string, number>)
    handleClose(false)
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
              <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
                {candidates.map((c) => {
                  const item = itemsByAtlasId.get(c.atlasId)
                  const isExcluded = !!excluded[c.atlasId]
                  return (
                    <div
                      key={c.atlasId}
                      className="flex items-center gap-2 py-2"
                      style={
                        c.needsReview
                          ? { background: 'var(--warning-bg, rgba(234,179,8,0.08))' }
                          : undefined
                      }
                    >
                      <Checkbox
                        checked={!isExcluded}
                        onCheckedChange={(checked) =>
                          setExcluded((prev) => ({ ...prev, [c.atlasId]: !checked }))
                        }
                      />
                      <ItemIdentity icon={item?.icon} name={c.name} size={26} />
                      <span className="flex-1 text-xs truncate" title={c.name} style={{ color: 'var(--text1)' }}>
                        {c.name}
                      </span>
                      {c.hasConflict && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#d97706', background: 'rgba(217,119,6,0.12)' }}>
                          {t('矛盾あり')}
                        </span>
                      )}
                      {c.needsReview && !c.hasConflict && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#d97706', background: 'rgba(217,119,6,0.12)' }}>
                          {t('要確認')}
                        </span>
                      )}
                      <span className="text-xs tabular-nums" style={{ color: 'var(--text2)' }}>
                        {c.currentQuantity}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text2)' }}>
                        →
                      </span>
                      <Input
                        type="number"
                        min={0}
                        className="w-24 h-8 text-right"
                        placeholder="-"
                        value={editedValues[c.atlasId] ?? ''}
                        onChange={(e) =>
                          setEditedValues((prev) => ({ ...prev, [c.atlasId]: e.target.value }))
                        }
                      />
                      {c.needsReview && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpandedCrop((prev) => ({ ...prev, [c.atlasId]: !prev[c.atlasId] }))
                          }
                        >
                          {t('元画像を確認')}
                        </Button>
                      )}
                      {c.needsReview && expandedCrop[c.atlasId] && (
                        <div className="basis-full flex flex-wrap gap-2 pl-8 pb-2">
                          {c.sources.map((s, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={s.cropDataUrl}
                              alt={c.name}
                              className="border rounded"
                              style={{ borderColor: 'var(--border)', maxHeight: 80 }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
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
