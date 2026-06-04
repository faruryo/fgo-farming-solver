'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { useDrops } from '../../hooks/use-drops'
import { Item } from '../../interfaces/atlas-academy'
import { getItemIconUrl } from '../../lib/get-item-icon-url'
import { buildNeedByApiItemId } from '../../lib/progress/compute-reduction'
import {
  priceCandidates,
  allocateAndMeasure,
  CandidateRef,
  DenominatorMode,
} from '../../lib/material-selection-advisor'
import { ServantPraise } from '../farming/ServantPraise'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

export type MaterialSelectionAdvisorProps = {
  /** 全選択可能アイテム(Atlas Academy)。 */
  items: Item[]
  /** atlasId 文字列 -> 必要数(育成計算機の material/result)。 */
  amounts: Record<string, number>
  /** atlasId 文字列 -> 所持数(育成計算機の posession)。 */
  possession: Record<string, number | undefined>
}

type AdvisorConfig = {
  /** 候補素材の atlasId 文字列リスト。 */
  candidateIds: string[]
  /** 獲得可能総数。 */
  total: number
  /** 最適化モード。 */
  mode: DenominatorMode
}

const STORAGE_KEY = 'material/selection-advisor-config'
const DEFAULT_CONFIG: AdvisorConfig = { candidateIds: [], total: 0, mode: 'ap' }

const unit = (mode: DenominatorMode) => (mode === 'ap' ? 'AP' : '周回')

/** 数値を見やすく丸める(整数 or 小数1桁)。 */
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

type Row = {
  item: Item
  id: string
  required: number
  owned: number
  deficiency: number
  allocated: number
  stillShort: number
  /** 1個あたり限界削減量(周回 or AP)。 */
  valuePerCopy: number
  saved: number
  /** ドロップ有・限界価値≈0(他素材集めのついでに揃う)。 */
  byproduct: boolean
  /** フリクエ恒常ドロップ無し。 */
  noDropData: boolean
}

const ProgressBar = ({ row }: { row: Row }) => {
  const denom = Math.max(row.required, row.owned + row.allocated, 1)
  const ownedPct = (Math.min(row.owned, denom) / denom) * 100
  const allocPct = (Math.min(row.allocated, Math.max(0, denom - row.owned)) / denom) * 100
  const shortPct = Math.max(0, 100 - ownedPct - allocPct)
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full"
      style={{ background: 'var(--border)' }}
      role="img"
      aria-label={`所持 ${row.owned}・推奨獲得 ${row.allocated}・不足 ${row.stillShort}`}
    >
      <div style={{ width: `${ownedPct}%`, background: 'var(--ok)' }} />
      <div
        style={{
          width: `${allocPct}%`,
          background: 'linear-gradient(90deg, var(--gold2), var(--gold))',
        }}
      />
      <div style={{ width: `${shortPct}%`, background: 'rgba(176,48,48,0.35)' }} />
    </div>
  )
}

export const MaterialSelectionAdvisor = ({
  items = [],
  amounts,
  possession,
}: MaterialSelectionAdvisorProps) => {
  const [config, setConfig] = useLocalStorage<AdvisorConfig>(STORAGE_KEY, DEFAULT_CONFIG)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // 候補素材を追加するピッカー(検索可能)の開閉と検索クエリ。
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // autoFocus だと Portal が body 先頭にレンダリングされる都合でページ最上部へスクロールしてしまうため、
  // Popover が開いた後にプログラムでフォーカスする。
  useEffect(() => {
    if (!pickerOpen) return
    const id = setTimeout(() => searchInputRef.current?.focus(), 30)
    return () => clearTimeout(id)
  }, [pickerOpen])

  const drops = useDrops()

  // atlasId 文字列 -> Item の索引。
  const itemsById = useMemo(() => {
    const m = new Map<string, Item>()
    for (const it of items) m.set(it.id.toString(), it)
    return m
  }, [items])

  // atlasId 文字列 -> 短縮 apiItemId(drops の item_id)。
  const atlasToShort = useMemo(() => {
    const m = new Map<string, string>()
    for (const it of drops.items) if (it.atlasId != null) m.set(String(it.atlasId), it.id)
    return m
  }, [drops.items])

  // 全クエストID(LP の許可クエスト)。最適周回プランの基準にユーザーの全不足を回す。
  const questIds = useMemo(() => drops.quests.map(q => q.id), [drops.quests])

  // ユーザーの全不足(短縮IDキー)。byproduct 判定には候補だけでなく全不足が必要。
  const fullNeed = useMemo(
    () => buildNeedByApiItemId(amounts, possession, drops),
    [amounts, possession, drops],
  )

  // 候補(atlasId・短縮ID・不足数)。
  const candidateRefs = useMemo<CandidateRef[]>(
    () =>
      config.candidateIds
        .map(id => {
          const shortId = atlasToShort.get(id)
          if (shortId == null) return null
          const required = amounts[id] ?? 0
          const owned = possession[id] ?? 0
          return { id, shortId, deficiency: Math.max(0, required - owned) }
        })
        .filter((c): c is CandidateRef => c != null),
    [config.candidateIds, atlasToShort, amounts, possession],
  )

  // 各候補の「1個あたり限界削減量」(シャドウプライス)。total に依存しないのでキャッシュ可。
  const pricing = useMemo(
    () => priceCandidates(drops, fullNeed, candidateRefs, config.mode, questIds),
    [drops, fullNeed, candidateRefs, config.mode, questIds],
  )

  const setMode = useCallback(
    (mode: DenominatorMode) => setConfig(prev => ({ ...prev, mode })),
    [setConfig],
  )
  const setTotal = useCallback(
    (raw: number) =>
      setConfig(prev => ({
        ...prev,
        total: Math.max(0, Math.floor(Number.isFinite(raw) ? raw : 0)),
      })),
    [setConfig],
  )
  const addCandidate = useCallback(
    (id: string) =>
      setConfig(prev =>
        prev.candidateIds.includes(id)
          ? prev
          : { ...prev, candidateIds: [...prev.candidateIds, id] },
      ),
    [setConfig],
  )
  const removeCandidate = useCallback(
    (id: string) =>
      setConfig(prev => ({
        ...prev,
        candidateIds: prev.candidateIds.filter(c => c !== id),
      })),
    [setConfig],
  )
  const reset = useCallback(() => setConfig(DEFAULT_CONFIG), [setConfig])

  // 限界価値で貪欲配分し、残余 need を再ソルブして厳密な合算削減量を測る。
  const { rows, totalSaved, totalAllocated, top } = useMemo(() => {
    const result = allocateAndMeasure(
      drops,
      fullNeed,
      candidateRefs,
      pricing,
      config.total,
      config.mode,
      questIds,
    )
    const rows: Row[] = candidateRefs.map((c, i) => {
      const alloc = result.allocations[i]
      const required = amounts[c.id] ?? 0
      const owned = possession[c.id] ?? 0
      return {
        item: itemsById.get(c.id) ?? ({ id: Number(c.id), name: c.id } as Item),
        id: c.id,
        required,
        owned,
        deficiency: c.deficiency,
        allocated: alloc.allocated,
        stillShort: Math.max(0, c.deficiency - alloc.allocated),
        valuePerCopy: alloc.valuePerCopy,
        saved: alloc.saved,
        byproduct: alloc.byproduct,
        noDropData: alloc.noDropData,
      }
    })
    const top = rows
      .filter(r => r.allocated > 0)
      .reduce<Row | null>((best, r) => (best == null || r.saved > best.saved ? r : best), null)
    return { rows, totalSaved: result.totalSaved, totalAllocated: result.totalAllocated, top }
  }, [drops, fullNeed, candidateRefs, pricing, config.total, config.mode, questIds, amounts, possession, itemsById])

  // 追加ドロップダウン候補: 未追加のアイテム。不足あり→必要あり→その他 の順に並べる。
  const addableItems = useMemo(() => {
    const selected = new Set(config.candidateIds)
    return items
      .filter(it => !selected.has(it.id.toString()))
      .map(it => {
        const id = it.id.toString()
        const required = amounts[id] ?? 0
        const owned = possession[id] ?? 0
        const deficiency = Math.max(0, required - owned)
        return { it, id, required, deficiency }
      })
      .sort((a, b) => {
        const rank = (x: typeof a) => (x.deficiency > 0 ? 0 : x.required > 0 ? 1 : 2)
        const dr = rank(a) - rank(b)
        if (dr !== 0) return dr
        return a.it.priority - b.it.priority
      })
  }, [items, config.candidateIds, amounts, possession])

  // 検索クエリで候補をフィルタ(素材名の部分一致・大文字小文字無視)。
  const filteredAddable = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return addableItems
    return addableItems.filter(({ it }) => it.name.toLowerCase().includes(q))
  }, [addableItems, query])

  // マシュからの動的アドバイス。
  const advice = useMemo(() => {
    if (config.candidateIds.length === 0) {
      return '指令を確認します、先輩。もらえる候補の素材を追加してください。あなたの全不足を周回ソルバーで最適化し、交換でどれを選べば実際に周回数が減るかを割り出します。'
    }
    if (config.total <= 0) {
      return 'まず「獲得可能総数」を入力してください、先輩。配布枚数や交換券の数を教えていただければ、即座に最適配分を計算します。'
    }
    const byproducts = rows.filter(r => r.byproduct && r.deficiency > 0)
    if (totalAllocated === 0) {
      if (rows.length > 0 && rows.every(r => r.noDropData)) {
        return '選択された素材はいずれもフリクエで恒常ドロップしないため、周回数の評価ができません、先輩。ドロップ対象の素材を追加してみてください。'
      }
      if (byproducts.length > 0) {
        return `${byproducts.map(r => `「${r.item.name}」`).join('・')}は、他の不足素材を集める周回のついでに揃ってしまうため、交換でもらっても周回数は減りません、先輩。交換枠は他の素材に回すのがおすすめです。`
      }
      return '現在、不足している候補がありません、先輩。充足済みのようです。素晴らしい進捗です！'
    }
    const u = unit(config.mode)
    const head = top
      ? `最優先は「${top.item.name}」です、先輩。これを ${top.allocated} 個もらうのが最も効率的です。`
      : ''
    const tail =
      config.mode === 'ap' ? 'りんごや石の温存に最適な配分です。' : 'リアルの周回時間を最小化する配分です。'
    const note =
      byproducts.length > 0
        ? `なお${byproducts.map(r => `「${r.item.name}」`).join('・')}は他の素材集めのついでに揃うため、交換対象から外しました。`
        : ''
    return `${head} この配分なら、あなたの最適周回プランから合計 約 ${fmt(totalSaved)} ${u} を削減できます。${tail}${note}`
  }, [config.candidateIds.length, config.total, config.mode, totalAllocated, totalSaved, top, rows])

  if (!mounted) return null

  return (
    <TooltipProvider>
    <div className="flex flex-col gap-4">
      {/* モード切替・総数入力 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span style={{ color: config.mode === 'ap' ? 'var(--gold)' : 'var(--text3)', fontWeight: 600 }}>
            AP節約優先
          </span>
          <Switch
            checked={config.mode === 'turn'}
            onCheckedChange={c => setMode(c ? 'turn' : 'ap')}
            aria-label="最適化モード切り替え"
          />
          <span style={{ color: config.mode === 'turn' ? 'var(--gold)' : 'var(--text3)', fontWeight: 600 }}>
            周回数節約優先
          </span>
        </div>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text2)' }}>
          獲得可能総数
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            className="w-24"
            value={config.total === 0 ? '' : config.total}
            placeholder="0"
            onChange={e => setTotal(Number(e.target.value))}
          />
        </label>
      </div>

      {/* マシュのアドバイス */}
      <ServantPraise message={advice} size={44} />

      {/* 候補スロット */}
      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          {rows.map(row => (
            <div
              key={row.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2"
              style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
            >
              {row.item.icon ? (
                <Image
                  src={getItemIconUrl(row.item.icon)}
                  alt={row.item.name}
                  width={36}
                  height={36}
                  className="flex-shrink-0 rounded"
                />
              ) : (
                <div className="h-9 w-9 flex-shrink-0 rounded" style={{ background: 'var(--border)' }} />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {row.item.name}
                  </span>
                  {row.allocated > 0 ? (
                    <span
                      className="flex-shrink-0 rounded px-2 py-0.5 text-xs font-bold"
                      style={{ background: 'var(--accent)', color: 'var(--gold)' }}
                    >
                      推奨 +{row.allocated}
                    </span>
                  ) : row.noDropData ? (
                    <span className="flex-shrink-0 text-xs" style={{ color: 'var(--text3)' }}>
                      対象外
                    </span>
                  ) : row.byproduct ? (
                    <span
                      className="flex flex-shrink-0 items-center gap-1 text-xs"
                      style={{ color: 'var(--steel)' }}
                    >
                      交換の効果なし
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              aria-label="詳しい説明"
                              className="inline-flex items-center justify-center rounded-full outline-none"
                              style={{ color: 'var(--steel)' }}
                            />
                          }
                        >
                          <Info className="h-3.5 w-3.5" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[15rem] text-left">
                          他の不足素材を集める周回で自然にドロップするため、交換でもらっても総周回数は変わりません。交換枠は他の素材に回すのがおすすめです。
                        </TooltipContent>
                      </Tooltip>
                    </span>
                  ) : (
                    <span className="flex-shrink-0 text-xs" style={{ color: 'var(--text3)' }}>
                      {row.deficiency === 0 ? '不足なし' : '推奨 0'}
                    </span>
                  )}
                </div>
                <div className="mt-1">
                  <ProgressBar row={row} />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs" style={{ color: 'var(--text2)' }}>
                  <span>所持 {row.owned}</span>
                  <span>必要 {row.required}</span>
                  {row.stillShort > 0 && (
                    <span style={{ color: 'var(--red)' }}>不足 {row.stillShort}</span>
                  )}
                  {row.noDropData ? (
                    <span style={{ color: 'var(--text3)' }}>フリクエ恒常ドロップ無し</span>
                  ) : row.byproduct ? (
                    <span style={{ color: 'var(--steel)' }}>他素材の周回で自然に揃う(削減 0)</span>
                  ) : row.deficiency > 0 ? (
                    <span>
                      約 {fmt(row.valuePerCopy)} {unit(config.mode)}/個 削減
                    </span>
                  ) : null}
                  {row.saved > 0 && (
                    <span style={{ color: 'var(--green)' }}>
                      −{fmt(row.saved)} {unit(config.mode)}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                aria-label={`${row.item.name} を削除`}
                onClick={() => removeCandidate(row.id)}
                className="flex-shrink-0 rounded p-1 text-lg leading-none transition-colors hover:bg-[var(--accent)]"
                style={{ color: 'var(--text3)' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 追加ドロップダウン・リセット */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover
          open={pickerOpen}
          onOpenChange={open => {
            setPickerOpen(open)
            if (!open) setQuery('')
          }}
        >
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={addableItems.length === 0}
                aria-label="候補素材を追加"
              />
            }
          >
            + 候補素材を追加
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 gap-2 p-2">
            <Input
              ref={searchInputRef}
              type="search"
              value={query}
              placeholder="素材名で検索…"
              onChange={e => setQuery(e.target.value)}
              aria-label="素材名で検索"
            />
            <div className="flex max-h-64 flex-col overflow-y-auto">
              {filteredAddable.length === 0 ? (
                <div className="px-2 py-3 text-center text-xs" style={{ color: 'var(--text3)' }}>
                  該当する素材がありません
                </div>
              ) : (
                filteredAddable.map(({ it, id, deficiency }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      addCandidate(id)
                      setPickerOpen(false)
                      setQuery('')
                    }}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--accent)]"
                  >
                    {it.icon ? (
                      <Image
                        src={getItemIconUrl(it.icon)}
                        alt=""
                        width={24}
                        height={24}
                        className="flex-shrink-0 rounded"
                      />
                    ) : (
                      <span
                        className="h-6 w-6 flex-shrink-0 rounded"
                        style={{ background: 'var(--border)' }}
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--text)' }}>
                      {it.name}
                    </span>
                    {deficiency > 0 && (
                      <span className="flex-shrink-0 text-xs" style={{ color: 'var(--red)' }}>
                        不足 {deficiency}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
        {(config.candidateIds.length > 0 || config.total > 0) && (
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            リセット
          </Button>
        )}
        {totalSaved > 0 && (
          <span className="ml-auto text-sm font-semibold" style={{ color: 'var(--green)' }}>
            合計 −{fmt(totalSaved)} {unit(config.mode)} 節約
          </span>
        )}
      </div>
    </div>
    </TooltipProvider>
  )
}
