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
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined' || options?.useInitial) return initialState
    try {
      const json = localStorage.getItem(key)
      if (json) {
        let obj = JSON.parse(json) as T
        if (options?.onGet) obj = options.onGet(obj)
        return obj
      }
    } catch (e) {
      console.error(e)
    }
    return initialState
  })

  // Use a ref to store the current state for reference in effects without triggering them
  const stateRef = useRef(state)
  stateRef.current = state

  // Update localStorage when state changes
  useEffect(() => {
    if (options?.useInitial) return
    const json = JSON.stringify(state)
    const oldJson = localStorage.getItem(key)
    
    // Only update and notify if the value actually changed
    if (json !== oldJson) {
      localStorage.setItem(key, json)
      window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key } }))
    }
  }, [key, state, options?.useInitial])

  // Listen for updates from other components
  useEffect(() => {
    if (options?.useInitial) return
    const handleUpdate = (e: Event) => {
      // If it's our own custom sync event, verify it's for this key
      if (e instanceof CustomEvent && e.type === 'ls-sync') {
        if ((e.detail as { key?: string })?.key !== key) return
      }

      const json = localStorage.getItem(key)
      if (json) {
        let obj = JSON.parse(json) as T
        if (options?.onGet) obj = options.onGet(obj)
        
        // CRITICAL: Avoid infinite loop by checking if state actually needs updating
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
