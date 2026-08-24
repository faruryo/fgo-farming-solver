import { Dispatch, SetStateAction, useMemo } from 'react'
import { ChaldeaState, createChaldeaState } from './create-chaldea-state'
import { useChaldeaStateMarger } from './use-chaldea-state-merger'
import { useLocalStorage } from './use-local-storage'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'

export const useChaldeaState = (
  ids: string[]
): [ChaldeaState, Dispatch<SetStateAction<ChaldeaState>>] => {
  const initialState = useMemo(() => createChaldeaState(['all', ...ids]), [ids])
  const mergeState = useChaldeaStateMarger(initialState)
  const [state, setState] = useLocalStorage(STORAGE_KEYS.MATERIAL, initialState, {
    onGet: mergeState,
  })
  return [state, setState]
}
