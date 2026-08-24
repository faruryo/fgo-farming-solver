import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { useLocalStorage } from './use-local-storage'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'

/**
 * 周回対象クエスト選択の永続化ロジック。
 *
 * 実際の永続化キーは 'excludedQuests'（除外リスト）だが、呼び出し側
 * （useChecked / useCheckboxTree / useQuestTree 等）は従来どおり
 * 'checkedQuests'（チェック済みリスト）意味論で扱えるよう、ここで反転
 * アダプタを提供する。あわせて旧 'quests' キー（チェック済みリスト）
 * からの一方向移行と、'quests' キーへのデュアルライト（既存の状態
 * スナップショット / クラウド同期契約の維持）を行う。
 *
 * `questIds` は呼び出し側で `useMemo` 済みの安定した参照を渡すこと。
 * このフック内の effect / memo は `questIds` の参照安定性に依存する
 * 依存配列を書いている箇所がある（特に移行 effect は意図的に `[]` を
 * 使っており、`questIds` の変化では再実行しない）。
 */
export const useExcludedQuests = (
  questIds: string[]
): [string[], Dispatch<SetStateAction<string[]>>] => {
  // 旧 'quests'(チェック済みリスト) → 'excludedQuests'(除外リスト) への一方向移行。
  // 除外リスト方式により、マスターデータに追加された新クエストは既定でチェックONになる。
  // 'excludedQuests' 既存時はスキップ（クラウド復元で旧 'quests' が後から書かれても
  // 上書きしない）。useLocalStorage('excludedQuests') より先に宣言し、その読み出し
  // effect より前に移行が完了するようにする（effect は宣言順に実行される）。
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEYS.EXCLUDED_QUESTS) != null) return
    const json = localStorage.getItem(STORAGE_KEYS.QUESTS)
    if (json == null) return
    try {
      const checked = JSON.parse(json) as unknown
      if (!Array.isArray(checked)) return
      const checkedSet = new Set(checked as string[])
      const excluded = questIds.filter((id) => !checkedSet.has(id))
      localStorage.setItem(STORAGE_KEYS.EXCLUDED_QUESTS, JSON.stringify(excluded))
    } catch (e) {
      console.error(e)
    }
  }, [])

  const [excludedQuests, setExcludedQuests] = useLocalStorage<string[]>(
    STORAGE_KEYS.EXCLUDED_QUESTS,
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
    if (localStorage.getItem(STORAGE_KEYS.QUESTS) !== json) {
      localStorage.setItem(STORAGE_KEYS.QUESTS, json)
      window.dispatchEvent(
        new CustomEvent('ls-sync', { detail: { key: STORAGE_KEYS.QUESTS } })
      )
    }
  }, [checkedQuests])

  return [checkedQuests, setCheckedQuests]
}
