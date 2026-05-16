/* eslint-disable react-hooks/exhaustive-deps */
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react'

export const useLocalStorage = <T>(
  key: string,
  initialState: T,
  options?: {
    onGet?: (item: T) => T
    useInitial?: boolean
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

  // Sync from localStorage after mount (client-only, runs after hydration)
  useEffect(() => {
    if (!options?.useInitial) {
      try {
        const json = localStorage.getItem(key)
        if (json) {
          let obj = JSON.parse(json) as T
          if (options?.onGet) obj = options.onGet(obj)
          setState(obj)
        }
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
    const json = JSON.stringify(state)
    const oldJson = localStorage.getItem(key)
    if (json !== oldJson) {
      localStorage.setItem(key, json)
      window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key } }))
    }
  }, [key, state, isInitialized, options?.useInitial])

  // Listen for updates from other components/tabs
  useEffect(() => {
    if (options?.useInitial) return
    const handleUpdate = (e: Event) => {
      if (e instanceof CustomEvent && e.type === 'ls-sync') {
        if ((e.detail as { key?: string })?.key !== key) return
      }
      const json = localStorage.getItem(key)
      if (json) {
        let obj = JSON.parse(json) as T
        if (options?.onGet) obj = options.onGet(obj)
        if (JSON.stringify(obj) !== JSON.stringify(stateRef.current)) {
          setState(obj)
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

  return [state, setState]
}
