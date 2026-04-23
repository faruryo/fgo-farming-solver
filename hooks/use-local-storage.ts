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
  const [state, setState] = useState(initialState)
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    if (optionsRef.current?.useInitial) return
    const read = () => {
      const json = localStorage.getItem(key)
      if (json) {
        let obj = JSON.parse(json) as T
        if (optionsRef.current?.onGet != null) {
          obj = optionsRef.current.onGet(obj)
        }
        setState(obj)
      }
    }
    read()
    window.addEventListener('localStorageUpdated', read)
    return () => window.removeEventListener('localStorageUpdated', read)
  }, [key])
  useEffect(() => localStorage.setItem(key, JSON.stringify(state)), [state])
  return [state, setState]
}
