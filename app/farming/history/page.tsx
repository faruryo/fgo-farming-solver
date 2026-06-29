'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '../../../components/common/link'
import { motion } from 'framer-motion'
import { Loader2, Trash2 } from 'lucide-react'
import { FaExternalLinkAlt, FaHistory } from 'react-icons/fa'
import {
  FarmingHistoryChart,
  HistoryItem,
  StockFilter,
  isStock,
} from '../../../components/farming/FarmingHistoryChart'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const OBJECTIVE_BADGE: Record<string, string> = {
  ap:   'AP MIN',
  lap:  'LAP MIN',
  both: 'AP+LAP',
}

interface QuestSelection {
  total: number
  selected: number
  mode: 'excluded' | 'selected'
  quests: { area: string; name: string }[]
  truncated?: boolean
}

const parseQuestSelection = (raw?: string | null): QuestSelection | null => {
  if (!raw) return null
  try {
    return JSON.parse(raw) as QuestSelection
  } catch {
    return null
  }
}

const QuestSelectionCell: React.FC<{ raw?: string | null }> = ({ raw }) => {
  const { t } = useTranslation(['farming'])
  const selection = parseQuestSelection(raw)

  if (!selection) {
    return <span style={{ color: 'var(--gold-dim)' }}>—</span>
  }

  const ratio = `${selection.selected}/${selection.total}`
  if (selection.selected >= selection.total || selection.quests.length === 0) {
    return <Badge variant="outline" className="text-[10px]">{ratio}</Badge>
  }

  const sideTotal =
    selection.mode === 'excluded'
      ? selection.total - selection.selected
      : selection.selected
  const remaining = sideTotal - selection.quests.length

  return (
    <Popover>
      <PopoverTrigger className="cursor-pointer">
        <Badge variant="outline" className="text-[10px]">{ratio}</Badge>
      </PopoverTrigger>
      <PopoverContent className="max-h-72 overflow-y-auto">
        <div className="text-xs font-bold" style={{ color: 'var(--gold-dim)' }}>
          {t(selection.mode === 'excluded' ? '除外クエスト' : '選択クエスト')}
        </div>
        <ul className="flex flex-col gap-1">
          {selection.quests.map((q, i) => (
            <li key={i} className="text-xs" style={{ color: 'var(--text)' }}>
              〔{q.area}〕{q.name}
            </li>
          ))}
        </ul>
        {selection.truncated && remaining > 0 && (
          <div className="text-xs" style={{ color: 'var(--gold-dim)' }}>
            {t('他{{count}}件', { count: remaining })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// 同一 batch_id を持つ A(必要分)と B(ストック込み)のペア。
type GroupedHistoryItem = HistoryItem & {
  // B行(stockIncluded=true)の行。batch_id=null のときは undefined。
  stockSibling?: HistoryItem
}

/**
 * 生の履歴行リストを batch_id でグルーピングし、ペアを1エントリに集約する。
 * - batch_id=null の行は単独エントリとして保持。
 * - ペアの主(A)は stock_included=false の行。
 * - 元の順序(created_at DESC)を維持する。
 */
const groupByBatch = (history: HistoryItem[]): GroupedHistoryItem[] => {
  // batch_id → { a: A行, b: B行 } のマップ
  const batchMap = new Map<string, { a: HistoryItem | null; b: HistoryItem | null }>()
  for (const item of history) {
    if (!item.batch_id) continue
    if (!batchMap.has(item.batch_id)) batchMap.set(item.batch_id, { a: null, b: null })
    const g = batchMap.get(item.batch_id)!
    if (item.stock_included) g.b = item
    else g.a = item
  }

  const seenBatches = new Set<string>()
  const result: GroupedHistoryItem[] = []
  for (const item of history) {
    if (!item.batch_id) {
      result.push(item)
    } else if (!seenBatches.has(item.batch_id)) {
      seenBatches.add(item.batch_id)
      const g = batchMap.get(item.batch_id)!
      // 主は A行(stock_included=false)。A が無いなら B を主にする(防御)。
      const primary = g.a ?? g.b!
      result.push({ ...primary, stockSibling: g.b ?? undefined })
    }
  }
  return result
}

export default function HistoryPage() {
  const { t } = useTranslation(['farming', 'common', 'dashboard'])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmItem, setConfirmItem] = useState<GroupedHistoryItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  // ストック込み/通常の絞り込み。グラフと一覧で共有するためページが所有する。
  const [stockOverride, setStockOverride] = useState<StockFilter | null>(null)

  // batch_id でグルーピングした一覧(表示用)。B 行は主カードに集約されるため除外。
  const groupedHistory = useMemo(() => groupByBatch(history), [history])

  // バッチペアは1エントリで通常(A)とストック込み(B)の両方を持つため、ペアが1件でもあれば
  // 両種別が存在する扱い。defaultFilter は最新エントリ基準(単独ストック行のみ stock 既定)。
  const { bothExist, defaultFilter } = useMemo(() => {
    let hasNormal = false
    let hasStock = false
    let mostRecent: GroupedHistoryItem | null = null
    for (const h of groupedHistory) {
      if (h.stockSibling) { hasNormal = true; hasStock = true }
      else if (isStock(h)) hasStock = true
      else hasNormal = true
      if (!mostRecent || new Date(h.created_at) > new Date(mostRecent.created_at)) mostRecent = h
    }
    return {
      bothExist: hasNormal && hasStock,
      defaultFilter: (mostRecent && !mostRecent.stockSibling && isStock(mostRecent) ? 'stock' : 'normal') as StockFilter,
    }
  }, [groupedHistory])
  const stockFilter = stockOverride ?? defaultFilter

  // グラフ用データ。一覧は常に全件表示(バッチカードが両値を持つため絞らない)。
  // グラフは種別が混在すると合計APの桁が変わり回帰(予測線)が破綻するため、stockFilter で
  // 系列を1つに絞る。バッチペアは通常=A値 / ストック込み=B値(stockSibling)を選ぶ。
  const chartHistory = useMemo(
    () => groupedHistory.flatMap(h => {
      if (h.stockSibling) {
        return [stockFilter === 'stock' ? h.stockSibling : { ...h, stockSibling: undefined }]
      }
      if (bothExist) return isStock(h) === (stockFilter === 'stock') ? [h] : []
      return [h]
    }),
    [groupedHistory, stockFilter, bothExist],
  )

  const handleDelete = async () => {
    if (!confirmItem) return
    setDeleting(true)
    setDeleteError(false)
    try {
      const res = await fetch(`/api/farming/results/${confirmItem.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`DELETE failed: ${res.status}`)
      // batch_id があれば同一バッチの全行(A+B)を raw history からも除去する。
      setHistory(prev =>
        confirmItem.batch_id
          ? prev.filter(h => h.batch_id !== confirmItem.batch_id)
          : prev.filter(h => h.id !== confirmItem.id)
      )
    } catch (err) {
      console.error(err)
      setDeleteError(true)
    } finally {
      setDeleting(false)
      setConfirmItem(null)
    }
  }

  useEffect(() => {
    fetch('/api/farming/history')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setHistory(data) })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="c-page">
        <div className="c-page-inner flex flex-col items-center justify-center gap-4 py-20">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: 'var(--gold)' }} />
          <p style={{ color: 'var(--gold-dim)' }}>Loading history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="flex flex-col gap-8">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <div className="c-page-en" style={{ letterSpacing: '0.2em' }}>FARMING HISTORY</div>
              <h1 className="c-page-title flex items-center gap-3">
                <FaHistory style={{ color: 'var(--gold)' }} />
                {t('common:計算履歴')}
              </h1>
            </div>
          </div>

          {groupedHistory.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <div className="c-card p-6">
                <FarmingHistoryChart
                  history={chartHistory}
                  stockFilter={stockFilter}
                  showStockToggle={bothExist}
                  onStockFilterChange={setStockOverride}
                />
              </div>
            </motion.div>
          )}

          {deleteError && (
            <div className="text-sm text-red-400">{t('削除に失敗しました')}</div>
          )}

          <div className="c-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4" style={{ color: 'var(--gold-dim)' }}>{t('日時')}</TableHead>
                  <TableHead className="px-4" style={{ color: 'var(--gold-dim)' }}>{t('目的')}</TableHead>
                  <TableHead className="px-4" style={{ color: 'var(--gold-dim)' }}>{t('対象クエスト')}</TableHead>
                  <TableHead className="text-right px-4" style={{ color: 'var(--gold)' }}>合計消費AP</TableHead>
                  <TableHead className="text-right px-4" style={{ color: 'var(--gold)' }}>合計周回数</TableHead>
                  <TableHead className="px-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedHistory.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm py-3 px-4" style={{ color: 'var(--text)' }}>
                      {new Date(item.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {OBJECTIVE_BADGE[item.objective] ?? item.objective}
                        </Badge>
                        {item.stock_included && !item.stockSibling ? (
                          // 旧形式の単独ストック込み行(batch_id=null)
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            style={{ color: 'var(--gold)', borderColor: 'var(--gold-dim)' }}
                          >
                            {t('ストック込み')}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <QuestSelectionCell raw={item.quest_selection} />
                    </TableCell>
                    <TableCell className="text-right py-3 px-4" style={{ color: 'var(--text2)' }}>
                      {item.stockSibling ? (
                        // バッチペア: 必要分 / +ストック差分を並べて表示
                        <div className="flex flex-col items-end gap-0.5">
                          <span>{Math.round(item.total_ap).toLocaleString()}</span>
                          <span className="text-xs" style={{ color: 'var(--gold-dim)' }}>
                            +{Math.round(item.stockSibling.total_ap - item.total_ap).toLocaleString()}
                            <Badge
                              variant="outline"
                              className="ml-1 text-[9px] px-1"
                              style={{ color: 'var(--gold)', borderColor: 'var(--gold-dim)' }}
                            >
                              {t('ストック込み')}
                            </Badge>
                          </span>
                        </div>
                      ) : (
                        Math.round(item.total_ap).toLocaleString()
                      )}
                    </TableCell>
                    <TableCell className="text-right py-3 px-4" style={{ color: 'var(--text2)' }}>
                      {item.stockSibling ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span>{Math.round(item.total_lap).toLocaleString()}</span>
                          <span className="text-xs" style={{ color: 'var(--gold-dim)' }}>
                            +{Math.round(item.stockSibling.total_lap - item.total_lap).toLocaleString()}周
                          </span>
                        </div>
                      ) : (
                        Math.round(item.total_lap).toLocaleString()
                      )}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger render={<span />}>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              style={{ color: 'var(--gold-dim)' }}
                              render={<Link href={`/farming/results/${item.id}`} />}
                              nativeButton={false}
                            >
                              <FaExternalLinkAlt />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('結果を見る')}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger render={<span />}>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              style={{ color: 'var(--gold-dim)' }}
                              onClick={() => setConfirmItem(item)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('削除')}</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {groupedHistory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10" style={{ color: 'var(--gold-dim)' }}>
                      {t('履歴がありません')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-center">
            <Link href="/farming" className="c-back-btn">
              {t('計算機に戻る')}
            </Link>
          </div>
        </div>
      </div>

      <AlertDialog open={!!confirmItem} onOpenChange={(open) => { if (!open) setConfirmItem(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('この履歴を削除しますか？')}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmItem?.stockSibling
                ? t('必要分・ストック込みの両方の履歴が削除されます。共有済みの結果ページは引き続き閲覧できます。')
                : t('グラフからも除外されます。共有済みの結果ページは引き続き閲覧できます。')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('common:キャンセル')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('削除')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
