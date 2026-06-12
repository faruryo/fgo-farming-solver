/* eslint-disable */
'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useCheckboxTree } from '../../hooks/use-checkbox-tree'
import { useChecked } from '../../hooks/use-checked-from-quest-state'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { useQuestTree } from '../../hooks/use-quest-tree'
import { Item, Quest } from '../../interfaces/fgodrop'
import { Localized } from '../../lib/get-local-items'
import { saveProgressSnapshot } from '../../lib/progress/snapshot-client'
import { groupBy } from '../../utils/group-by'
import { CheckboxTree } from '../common/checkbox-tree'
import { ItemFieldset } from './item-fieldset'
import { ResetAlertDialog } from './reset-alert-dialog'

export type FarmingIndexProps = {
  items: Localized<Item>[]
  quests: Quest[]
}

type InputState = {
  itemCounts: { [key: string]: string }
  checkedQuests: string[]
}
type QueryInputState = {
  items: string
  quests?: string
}

const inputToQuery = ({ itemCounts, checkedQuests }: InputState) => ({
  items: Object.entries(itemCounts)
    .filter(([, count]) => count != '')
    .map(([item, count]) => item + ':' + count)
    .join(','),
  quests: checkedQuests
    .reduce(
      (acc, cur) =>
        acc.includes(cur[0]) || acc.includes(cur.slice(0, 2))
          ? acc
          : [...acc, cur],
      [] as string[]
    )
    .join(','),
})

const migrateLocalInput = () => {
  const json = localStorage.getItem('input')
  if (json == null || json == 'undefined') {
    return
  }
  const input = JSON.parse(json) as unknown
  if (typeof input == 'object' && input != null) {
    Object.entries(input).forEach(([key, value]) =>
      localStorage.setItem(key, JSON.stringify(value))
    )
  }
  localStorage.removeItem('input')
}
const hasItems = (arg: unknown): arg is { items: unknown } =>
  typeof arg == 'object' && arg != null && 'items' in arg

const isInputState = (arg: unknown): arg is QueryInputState =>
  hasItems(arg) && typeof arg.items == 'string'

const hasId = (arg: unknown): arg is { id: unknown } =>
  typeof arg == 'object' && arg != null && 'id' in arg

export const Index = ({ items, quests }: FarmingIndexProps) => {
  useEffect(migrateLocalInput, [])
  const { t } = useTranslation('farming')
  const { tree } = useQuestTree(quests)
  const questIds = useMemo(() => quests.map(({ id }) => id), [quests])
  const initialItemCounts = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, ''])),
    [items]
  )
  const [itemCounts, setItemCounts] = useLocalStorage(
    'items',
    initialItemCounts
  )

  // 旧 'quests'(チェック済みリスト) → 'excludedQuests'(除外リスト) への一方向移行。
  // 除外リスト方式により、マスターデータに追加された新クエストは既定でチェックONになる。
  // 'excludedQuests' 既存時はスキップ（クラウド復元で旧 'quests' が後から書かれても
  // 上書きしない）。useLocalStorage('excludedQuests') より先に宣言し、その読み出し
  // effect より前に移行が完了するようにする（effect は宣言順に実行される）。
  useEffect(() => {
    if (localStorage.getItem('excludedQuests') != null) return
    const json = localStorage.getItem('quests')
    if (json == null) return
    try {
      const checked = JSON.parse(json) as unknown
      if (!Array.isArray(checked)) return
      const checkedSet = new Set(checked as string[])
      const excluded = questIds.filter((id) => !checkedSet.has(id))
      localStorage.setItem('excludedQuests', JSON.stringify(excluded))
    } catch (e) {
      console.error(e)
    }
  }, [])

  const [excludedQuests, setExcludedQuests] = useLocalStorage<string[]>(
    'excludedQuests',
    []
  )

  // checked semantics（チェック済みリスト + setter）への反転アダプタ。
  // useChecked / useCheckboxTree / URL クエリ反映 / solve 送信は従来どおり
  // チェック済みリストで動き、永続化だけが除外リストになる。
  const checkedQuests = useMemo(() => {
    const excludedSet = new Set(excludedQuests)
    return questIds.filter((id) => !excludedSet.has(id))
  }, [questIds, excludedQuests])
  const setCheckedQuests = useCallback<Dispatch<SetStateAction<string[]>>>(
    (action) => {
      setExcludedQuests((prevExcluded) => {
        const excludedSet = new Set(prevExcluded)
        const prevChecked = questIds.filter((id) => !excludedSet.has(id))
        const nextChecked =
          typeof action === 'function' ? action(prevChecked) : action
        const checkedSet = new Set(nextChecked)
        return questIds.filter((id) => !checkedSet.has(id))
      })
    },
    [questIds, setExcludedQuests]
  )

  // legacy 'quests' キーへのデュアルライト（状態スナップショット / クラウド同期の
  // 既存契約維持）。初回 flush は excludedQuests が localStorage から読まれる前の
  // 「全チェック」状態なので skip する（保存済みの 'quests' を破壊しない）。
  const dualWriteStarted = useRef(false)
  useEffect(() => {
    if (!dualWriteStarted.current) {
      dualWriteStarted.current = true
      return
    }
    const json = JSON.stringify(checkedQuests)
    if (localStorage.getItem('quests') !== json) {
      localStorage.setItem('quests', json)
      window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: 'quests' } }))
    }
  }, [checkedQuests])
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isConfirming_, setIsConfirming_] = useState(false)
  const setIsConfirming = { on: () => setIsConfirming_(true), off: () => setIsConfirming_(false) }
  const isConfirming = isConfirming_
  const [isLoading_, setIsLoading_] = useState(false)
  const setIsLoading = { on: () => setIsLoading_(true), off: () => setIsLoading_(false) }
  const isLoading = isLoading_
  const [selected, setSelected] = useChecked(
    questIds,
    checkedQuests,
    setCheckedQuests
  )
  const { checked, onCheck, expanded, onExpand } = useCheckboxTree(
    tree,
    selected,
    setSelected
  )

  useEffect(() => {
    if (!searchParams) return
    const query = Object.fromEntries(searchParams.entries())
    if (isInputState(query)) {
      setItemCounts(
        (itemCounts) =>
          Object.fromEntries(
            query.items
              .split(',')
              .map((itemCount) => itemCount.split(':', 2) as [string, string])
          ) ?? itemCounts
      )
      setCheckedQuests((checkedQuests) => {
        const { quests } = query
        if (quests == null) {
          return checkedQuests
        } else {
          return questIds.filter(
            (id) =>
              quests.includes(id[0]) ||
              quests.includes(id.slice(0, 2)) ||
              quests.includes(id)
          )
        }
      })
      router.replace('/farming')
    }
     
  }, [])

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setIsLoading.on()
      const query = inputToQuery({ itemCounts, checkedQuests })
      const params = new URLSearchParams({ ...query, fields: 'id' })
      const url = `/api/solve?${params.toString()}`
      const result = await fetch(url).then((res) => res.json() as unknown)
      if (hasId(result) && typeof result.id == 'string') {
        const url = `/farming/results/${result.id}`
        localStorage.setItem('farming/results', url)
        // Notify change tracking (dirty metadata / auto-save) — direct
        // setItem is invisible to the cloud-sync modification listener.
        window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: 'farming/results' } }))
        // Persist a full-state progress snapshot (incl. material) for this run.
        // Fire-and-forget so it never blocks navigation to the result page.
        void saveProgressSnapshot()
        await router.push(url)
      } else {
        await router.push('/500')
      }
    },
    [checkedQuests, itemCounts, router, setIsLoading]
  )

  const onReset = useCallback(() => {
    setItemCounts(initialItemCounts)
    setCheckedQuests(questIds)
  }, [initialItemCounts, questIds, setCheckedQuests, setItemCounts])

  const handleItemChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const { name, value } = event.currentTarget
      setItemCounts((itemCounts) => ({ ...itemCounts, [name]: value }))
    },
    [setItemCounts]
  )

  const itemGroups = Object.entries(
    groupBy(items, ({ largeCategory }) => largeCategory)
  ).map(([largeCategory, items]): [string, [string, Localized<Item>[]][]] => [
    largeCategory,
     
    Object.entries(groupBy(items, ({ category }) => category)) as any,
  ])

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}
    <div className="c-page">
      <div className="c-page-inner">
        <div className="c-page-header">
          <div>
            <div className="c-page-en">FARMING SOLVER</div>
            <h1 className="c-page-title">{t('周回効率計算')}</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-8">
            <ItemFieldset
              itemGroups={itemGroups}
              inputItems={itemCounts}
              handleChange={handleItemChange}
            />
            {Object.values(itemCounts).every((count) => count == '') && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>
                  {t('集めたいアイテムの数を最低1つ入力してください。')}
                </AlertDescription>
              </Alert>
            )}
            <fieldset style={{ width: '100%' }}>
              <legend className="c-settings-section-label mb-4 flex">
                {t('周回対象に含めるクエスト')}
              </legend>
              <div className="c-card w-full p-5">
                <CheckboxTree
                  tree={tree}
                  checked={checked}
                  onCheck={onCheck}
                  expanded={expanded}
                  onExpand={onExpand}
                />
              </div>
            </fieldset>
            {checkedQuests.length == 0 && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>
                  {t('周回対象に含めるクエストを最低1つ選択してください。')}
                </AlertDescription>
              </Alert>
            )}

            <div className="c-farming-footer">
              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={
                    isLoading ||
                    Object.values(itemCounts).every((count) => count == '') ||
                    checkedQuests.length == 0
                  }
                  className="c-farming-btn"
                >
                  <span className="c-farming-btn-en">SOLVE FARMING</span>
                  <span className="c-farming-btn-jp">{t('周回数を求める')}</span>
                </Button>
                <Button
                  type="button"
                  onClick={setIsConfirming.on}
                  className="c-farming-btn-reset"
                >
                  {t('リセット')}
                </Button>
              </div>
            </div>

            <ResetAlertDialog
              isOpen={isConfirming}
              onClose={setIsConfirming.off}
              onReset={onReset}
            />
          </div>
        </form>
      </div>
    </div>
    </>
  )
}
