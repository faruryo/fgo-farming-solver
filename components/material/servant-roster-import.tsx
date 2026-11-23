'use client'

import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageUp } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ChaldeaState } from '../../hooks/create-chaldea-state'
import type { MaterialCatalogServant } from '../../lib/material-catalog'
import type { ServantLevelImportRow, ServantLevels } from '../../lib/servant-levels'
import type { RosterImportResult, RosterProgress } from '../../lib/servant-roster-import/types'
import { currentSkillsById } from '../../lib/servant-roster-owned'
import { RosterReviewStage } from './servant-roster-review'

type Stage = 'upload' | 'analyzing' | 'review'

const isImage = (file: File): boolean => file.type.startsWith('image/')

/** 撮る画面と並びの案内と、画像を選ぶ欄 */
const FileDropZone: React.FC<{ onAdd: (files: FileList | File[]) => void }> = ({ onAdd }) => {
  const { t } = useTranslation('material')
  return (
    <div
      className="border border-dashed rounded-lg p-6 text-sm flex flex-col gap-2"
      style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault()
        onAdd(e.dataTransfer.files)
      }}
    >
      <p>
        {t(
          'roster-import-guide',
          'ゲームの「サーヴァント強化」でサーヴァントを選ぶ画面を、並びを「宝具Lv.順」にして、上から下まで少しずつ重ねて撮ってください。宝具Lv と Lv の両方を読み取ります。',
        )}
      </p>
      <p>{t('roster-import-guide-lv-sort', '「Lv.順」の画像も読めますが、その画像からは Lv だけを取り込みます。')}</p>
      <p>
        {t(
          'roster-import-guide-skill',
          '「サーヴァントスキル強化」でサーヴァントを選ぶ画面は、7列の表示で同じように撮ってください。宝具Lv とスキルLv を読み取り、スキルLv は育成計算機のスキルの「今」に入れます。どちらの画面も、6列・5列の表示は読み取れません。',
        )}
      </p>
      <label className="self-center">
        <span className="inline-flex items-center h-8 px-3 rounded-lg border cursor-pointer text-sm" style={{ borderColor: 'var(--border)' }}>
          {t('roster-import-choose', '画像を選ぶ（複数可）')}
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          data-testid="roster-import-file-input"
          onChange={e => {
            if (e.target.files) onAdd(e.target.files)
            e.target.value = ''
          }}
        />
      </label>
    </div>
  )
}

/** 画像を選ぶ段。画像でないファイルは除いて知らせる */
const UploadStage: React.FC<{
  files: File[]
  skippedNames: string[]
  error: string | null
  onAdd: (files: FileList | File[]) => void
  onCancel: () => void
  onAnalyze: () => void
}> = ({ files, skippedNames, error, onAdd, onCancel, onAnalyze }) => {
  const { t } = useTranslation('material')
  return (
    <div className="flex flex-col gap-3">
      <FileDropZone onAdd={onAdd} />
      {files.length > 0 && (
        <ul className="text-xs" style={{ color: 'var(--text2)' }}>
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>{f.name}</li>
          ))}
        </ul>
      )}
      {skippedNames.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--red)' }}>
          {t('roster-import-skipped', '画像でないファイルを除きました: {{names}}', { names: skippedNames.join(', ') })}
        </p>
      )}
      {error && (
        <p className="text-xs" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {t('roster-import-close', '閉じる')}
        </Button>
        <Button disabled={files.length === 0} onClick={onAnalyze}>
          {t('roster-import-analyze', '読み取る')}
        </Button>
      </DialogFooter>
    </div>
  )
}

const AnalyzingStage: React.FC<{ progress: RosterProgress | null }> = ({ progress }) => {
  const { t } = useTranslation('material')
  const text =
    progress?.phase === 'image'
      ? t('roster-import-progress-image', '画像を読み取っています {{current}} / {{total}}', {
          current: progress.current,
          total: progress.total,
        })
      : t('roster-import-progress-icons', '照合用のデータを読み込んでいます…')
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <div
        className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--border)', borderTopColor: 'transparent' }}
      />
      <p className="text-sm" style={{ color: 'var(--text2)' }}>
        {text}
      </p>
    </div>
  )
}

/** 照合用のデータを読み込めなかったときの確かめの段。行を出さず、時間をおいてやり直すよう知らせる */
const IconsUnavailableStage: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
  const { t } = useTranslation('material')
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm py-6 text-center" style={{ color: 'var(--red)' }}>
        {t('roster-import-icons-unavailable', '照合用のデータを読み込めませんでした。時間をおいてやり直してください。')}
      </p>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {t('roster-import-close', '閉じる')}
        </Button>
      </DialogFooter>
    </div>
  )
}

/**
 * 選ぶ・読み取る・確かめるの3段の状態。読み取りのモジュール（文字認識と照合用のデータの読み込み）は、
 * 画像を選んで読み取りを始めたときに動的 import するので、それまで読み込まない。
 */
const useRosterImportFlow = (servants: readonly MaterialCatalogServant[], levels: ServantLevels, chaldeaState: ChaldeaState) => {
  const [stage, setStage] = useState<Stage>('upload')
  const [files, setFiles] = useState<File[]>([])
  const [skippedNames, setSkippedNames] = useState<string[]>([])
  const [progress, setProgress] = useState<RosterProgress | null>(null)
  const [result, setResult] = useState<RosterImportResult>()
  const [error, setError] = useState<string | null>(null)
  // 閉じたあとに終わった読み取りの結果を捨てるための、読み取りの回の番号
  const runRef = useRef(0)
  const reset = () => {
    runRef.current += 1
    setStage('upload')
    setFiles([])
    setSkippedNames([])
    setProgress(null)
    setResult(undefined)
    setError(null)
  }
  const addFiles = (incoming: FileList | File[]) => {
    const all = Array.from(incoming)
    const rejected = all.filter(f => !isImage(f))
    if (rejected.length > 0) setSkippedNames(prev => [...prev, ...rejected.map(f => f.name)])
    setFiles(prev => [...prev, ...all.filter(isImage)])
  }
  const analyze = async () => {
    setStage('analyzing')
    setError(null)
    setProgress(null)
    const run = (runRef.current += 1)
    const current = () => runRef.current === run
    try {
      const { analyzeRosterScreenshots } = await import('../../lib/servant-roster-import/analyze')
      const next = await analyzeRosterScreenshots(files, {
        servants: servants.map(s => ({ id: s.id, rarity: s.rarity })),
        stored: levels,
        storedSkills: currentSkillsById(chaldeaState),
        onProgress: p => {
          if (current()) setProgress(p)
        },
      })
      if (!current()) return
      setResult(next)
      setStage('review')
    } catch (e) {
      if (!current()) return
      setError(e instanceof Error ? e.message : String(e))
      setStage('upload')
    }
  }
  return { stage, files, skippedNames, progress, result, error, reset, addFiles, analyze }
}

type ImportProps = {
  servants: readonly MaterialCatalogServant[]
  levels: ServantLevels
  /** 育成計算機の画面が使っている、保存値を補ったあとの状態（新しく所持になる数を数える） */
  chaldeaState: ChaldeaState
  /** 確定した行（取り込みに入れた行だけ）。所持の印と Lv・宝具Lv・スキルの「今」を書くのは呼び出し側 */
  onConfirm: (rows: ServantLevelImportRow[]) => void
}

const RosterImportDialog: React.FC<ImportProps & { open: boolean; onOpenChange: (open: boolean) => void }> = ({
  open,
  onOpenChange,
  servants,
  levels,
  chaldeaState,
  onConfirm,
}) => {
  const { t } = useTranslation('material')
  const flow = useRosterImportFlow(servants, levels, chaldeaState)
  const handleOpenChange = (next: boolean) => {
    if (!next) flow.reset()
    onOpenChange(next)
  }
  const close = () => handleOpenChange(false)
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto gap-5">
        <DialogHeader>
          <DialogTitle>{t('roster-import-title', 'スクリーンショットから取り込む')}</DialogTitle>
          <DialogDescription>
            {t(
              'roster-import-description',
              'サーヴァント強化・サーヴァントスキル強化の選択画面のスクリーンショットから、所持サーヴァントと Lv・宝具Lv・スキルLv を読み取ります。画像はブラウザの中で読み取り、外へは送りません。',
            )}
          </DialogDescription>
        </DialogHeader>
        {flow.stage === 'upload' && (
          <UploadStage
            files={flow.files}
            skippedNames={flow.skippedNames}
            error={flow.error}
            onAdd={flow.addFiles}
            onCancel={close}
            onAnalyze={() => void flow.analyze()}
          />
        )}
        {flow.stage === 'analyzing' && <AnalyzingStage progress={flow.progress} />}
        {flow.stage === 'review' && flow.result?.kind === 'icons-unavailable' && <IconsUnavailableStage onCancel={close} />}
        {flow.stage === 'review' && flow.result?.kind === 'done' && (
          <RosterReviewStage
            result={flow.result}
            servants={servants}
            levels={levels}
            chaldeaState={chaldeaState}
            onCancel={close}
            onConfirm={rows => {
              onConfirm(rows)
              close()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * サーヴァント強化・サーヴァントスキル強化の選択画面のスクリーンショットから、所持サーヴァントと Lv・宝具Lv・スキルLv を取り込む入口とダイアログ。
 * 画像はブラウザの中で読み取り、外へは送らない。確定せずに閉じたときは何も渡さない。
 */
export const ServantRosterImport: React.FC<ImportProps> = props => {
  const { t } = useTranslation('material')
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ImageUp aria-hidden="true" />
        {t('roster-import-open', 'スクリーンショットから取り込む')}
      </Button>
      <RosterImportDialog open={open} onOpenChange={setOpen} {...props} />
    </>
  )
}
