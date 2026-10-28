import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

/**
 * `onGet` 用。保存値が object（配列を除く）でなければ空の object として読む。
 * 壊れた保存値（`null` など）で `Object.entries` などが投げて描画が落ちるのを防ぐ。
 */
export const recordOrEmpty = <V>(item: unknown): Record<string, V> =>
  item !== null && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, V>) : {}

/** `onGet` 用（所持数）。`recordOrEmpty` に加え、有限の数でない値の品目を外す。 */
export const countsOrEmpty = (item: unknown): Record<string, number> =>
  Object.fromEntries(
    Object.entries(recordOrEmpty(item)).filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1]))
  )

/** `onGet` 用（周回目標）。入力欄の文字列（`''` を含む）は残し、数として読めない値の品目を外す。 */
export const itemCountsOrEmpty = <V extends string | number = string | number>(item: unknown): Record<string, V> =>
  Object.fromEntries(
    Object.entries(recordOrEmpty(item)).filter(([, v]) =>
      typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' && Number.isFinite(Number(v))
    )
  ) as Record<string, V>

export const useLocalStorage = <T>(
  key: string,
  initialState: T,
  options?: {
    onGet?: (item: T) => T
    useInitial?: boolean
    // 読むだけの画面が未設定端末へ初期値や onGet 変換結果を書き込まないよう、
    // 返した setter が呼ばれるまで保存しない。
    lazyWrite?: boolean
    // onGet で変わった保存値を壊れた値の補正とみなし、読んだ時に1回だけ書き戻す。
    // 補正はユーザーの編集ではないので derived で通知し、クラウド同期の dirty にしない
    // （壊れていない端末のクラウド値を補正だけで上書きしない）。
    repairOnGet?: boolean
  }
): [T, Dispatch<SetStateAction<T>>] => {
  // Always initialize with initialState to avoid SSR/hydration mismatch.
  // Reading localStorage in the useState initializer causes the server to render
  // with initialState while the client renders with the stored value, which React
  // treats as a hydration error.
  const [state, setState] = useState<T>(initialState)
  const [isInitialized, setIsInitialized] = useState(false)

  const stateRef = useRef(state)
  stateRef.current = state
  const editedRef = useRef(false)
  const lazyWrite = options?.lazyWrite

  const parseStored = (json: string): T => {
    const parsed = JSON.parse(json) as T
    if (!options?.onGet) return parsed
    const obj = options.onGet(parsed)
    if (options.repairOnGet && JSON.stringify(obj) !== JSON.stringify(parsed)) {
      localStorage.setItem(key, JSON.stringify(obj))
      window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key, derived: true } }))
    }
    return obj
  }

  // Sync from localStorage after mount (client-only, runs after hydration)
  useEffect(() => {
    if (!options?.useInitial) {
      try {
        const json = localStorage.getItem(key)
        if (json) setState(parseStored(json))
      } catch (e) {
        console.error(e)
      }
    }
    setIsInitialized(true)
  }, [key])

  // Persist state changes to localStorage (only after initialization to avoid
  // overwriting stored values with initialState on first render)
  useEffect(() => {
    if (!isInitialized || options?.useInitial) return
    if (lazyWrite && !editedRef.current) return
    const json = JSON.stringify(state)
    const oldJson = localStorage.getItem(key)
    if (json !== oldJson) {
      localStorage.setItem(key, json)
      // Persisting a missing key's default value is initialization, not a user
      // edit. Reporting it as dirty can turn a fresh device's safe cloud restore
      // into a false conflict. Later writes still emit the normal sync signal.
      if (oldJson !== null || lazyWrite) {
        window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key } }))
      }
    }
  }, [key, state, isInitialized, options?.useInitial, lazyWrite])

  // Listen for updates from other components/tabs
  useEffect(() => {
    if (options?.useInitial) return
    const handleUpdate = (e: Event) => {
      if (e instanceof CustomEvent && e.type === 'ls-sync') {
        if ((e.detail as { key?: string })?.key !== key) return
      }
      const json = localStorage.getItem(key)
      if (json) {
        try {
          const obj = parseStored(json)
          if (JSON.stringify(obj) !== JSON.stringify(stateRef.current)) {
            setState(obj)
          }
        } catch (e) {
          console.error(e)
        }
      }
    }
    window.addEventListener('ls-sync', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('ls-sync', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [key, options?.onGet, options?.useInitial])

  const setEditedState = useCallback<Dispatch<SetStateAction<T>>>((value) => {
    editedRef.current = true
    setState(value)
  }, [])

  return [state, lazyWrite ? setEditedState : setState]
}
