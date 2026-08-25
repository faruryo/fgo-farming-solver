import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { TargetKey } from '../interfaces/atlas-academy'
import { MaterialsForServants } from '../lib/get-materials'
import { MaterialCatalogItem, MaterialCatalogServant } from '../lib/material-catalog'
import { useLocalStorage } from './use-local-storage'
import { diffMaterialsForStartChange, MaterialDelta } from '../lib/diff-materials'
import { showTrackingToast, showBlockedToast } from '../lib/tracking-toast'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'

export interface UseTrackingLedgerOptions {
  materials: MaterialsForServants
  servantsById: Record<string, MaterialCatalogServant>
  itemsById: Record<string, MaterialCatalogItem>
}

export interface UseTrackingLedgerReturn {
  trackingMode: boolean
  setTrackingMode: (value: boolean | ((val: boolean) => boolean)) => void
  trackingDismissed: boolean
  setTrackingDismissed: (value: boolean | ((val: boolean) => boolean)) => void
  possession: Record<string, number | undefined>
  setPossession: (
    value:
      | Record<string, number | undefined>
      | ((prev: Record<string, number | undefined>) => Record<string, number | undefined>)
  ) => void
  hasPossessionInput: boolean
  checkStartChange: (
    servantId: string,
    target: TargetKey,
    idx: number,
    prevStart: number,
    newStart: number
  ) => boolean
  applyStartChange: (
    servantId: string,
    target: TargetKey,
    idx: number,
    prevStart: number,
    newStart: number
  ) => void
}

const hasNonZeroPossession = (p: Record<string, number | undefined>): boolean =>
  Object.values(p).some((v) => typeof v === 'number' && v > 0)

const getItem = <T>(obj: Record<string, T>, key: string): T | undefined =>
  Reflect.get(obj, key)

const setItem = <T>(obj: Record<string, T>, key: string, value: T): void => {
  Reflect.set(obj, key, value)
}

const buildShortageItems = (
  deltaItems: { itemId: string; amount: number }[],
  poss: Record<string, number | undefined>,
  itemsById: Record<string, MaterialCatalogItem>
) =>
  deltaItems
    .filter(({ itemId, amount }) => (getItem(poss, itemId) ?? 0) < amount)
    .map(({ itemId, amount }) => {
      const itemMeta = getItem(itemsById, itemId)
      const owned = getItem(poss, itemId) ?? 0
      return {
        itemId,
        owned,
        required: amount,
        name: itemMeta?.name ?? itemId,
        icon: itemMeta?.icon,
      }
    })

const updatePossessionWithDelta = (
  prev: Record<string, number | undefined>,
  delta: MaterialDelta
): Record<string, number | undefined> => {
  const next: Record<string, number | undefined> = { ...prev }
  delta.items.forEach(({ itemId, amount }) => {
    const cur = getItem(next, itemId) ?? 0
    setItem(next, itemId, delta.direction === 'consume' ? cur - amount : cur + amount)
  })
  return next
}

interface CheckContext {
  servantId: string
  target: TargetKey
  idx: number
  prevStart: number
  newStart: number
  materials: MaterialsForServants
  possession: Record<string, number | undefined>
  itemsById: Record<string, MaterialCatalogItem>
  servantsById: Record<string, MaterialCatalogServant>
  setPossession: UseTrackingLedgerReturn['setPossession']
}

const executeBlockedCheck = (ctx: CheckContext): boolean => {
  const servantMats = getItem(ctx.materials, ctx.servantId)
  if (!servantMats) return true

  const delta = diffMaterialsForStartChange(servantMats, ctx.target, ctx.prevStart, ctx.newStart)
  if (!delta || delta.direction !== 'consume') return true

  const shortageItems = buildShortageItems(delta.items, ctx.possession, ctx.itemsById)
  if (shortageItems.length === 0) return true

  const servant = getItem(ctx.servantsById, ctx.servantId)
  showBlockedToast({
    servantName: servant?.name ?? ctx.servantId,
    target: ctx.target,
    idx: ctx.idx,
    prevStart: ctx.prevStart,
    newStart: ctx.newStart,
    shortageItems,
    onSetPossession: (newValues) =>
      ctx.setPossession((prev) => ({ ...prev, ...newValues })),
  })
  return false
}

interface ApplyContext {
  servantId: string
  target: TargetKey
  idx: number
  prevStart: number
  newStart: number
  materials: MaterialsForServants
  itemsById: Record<string, MaterialCatalogItem>
  servantsById: Record<string, MaterialCatalogServant>
  setPossession: UseTrackingLedgerReturn['setPossession']
}

const executeStartApply = (ctx: ApplyContext): void => {
  const servantMats = getItem(ctx.materials, ctx.servantId)
  if (!servantMats) return

  const delta = diffMaterialsForStartChange(servantMats, ctx.target, ctx.prevStart, ctx.newStart)
  if (!delta) return

  ctx.setPossession((prev) => updatePossessionWithDelta(prev, delta))

  const servant = getItem(ctx.servantsById, ctx.servantId)
  if (!servant) return

  showTrackingToast({
    servantId: ctx.servantId,
    servantName: servant.name,
    servantMaterials: servantMats,
    target: ctx.target,
    idx: ctx.idx,
    prevStart: ctx.prevStart,
    newStart: ctx.newStart,
    itemsById: ctx.itemsById,
  })
}

const useTrackingStorage = () => {
  const [trackingMode, setTrackingMode] = useLocalStorage<boolean>(
    STORAGE_KEYS.TRACKING_MODE,
    false
  )
  const [trackingDismissed, setTrackingDismissed] = useLocalStorage<boolean>(
    STORAGE_KEYS.TRACKING_SUGGEST_DISMISSED,
    false
  )
  const [possession, setPossession] = useLocalStorage<Record<string, number | undefined>>(
    STORAGE_KEYS.POSSESSION,
    {}
  )
  return {
    trackingMode,
    setTrackingMode,
    trackingDismissed,
    setTrackingDismissed,
    possession,
    setPossession,
  }
}

const usePossessionHistory = (possession: Record<string, number | undefined>): boolean => {
  const [hasHadPossession, setHasHadPossession] = useState(false)
  const hasPossessionInput = hasHadPossession || hasNonZeroPossession(possession)
  if (!hasHadPossession && hasPossessionInput) {
    setHasHadPossession(true)
  }
  return hasPossessionInput
}

interface CallbackHookOptions {
  trackingMode: boolean
  materials: MaterialsForServants
  possessionRef: RefObject<Record<string, number | undefined>>
  itemsById: Record<string, MaterialCatalogItem>
  servantsById: Record<string, MaterialCatalogServant>
  setPossession: UseTrackingLedgerReturn['setPossession']
}

const useTrackingCallbacks = ({
  trackingMode,
  materials,
  possessionRef,
  itemsById,
  servantsById,
  setPossession,
}: CallbackHookOptions) => {
  const checkStartChange = useCallback(
    (servantId: string, target: TargetKey, idx: number, prevStart: number, newStart: number) =>
      !trackingMode || servantId === 'all' || newStart <= prevStart
        ? true
        : executeBlockedCheck({
            servantId,
            target,
            idx,
            prevStart,
            newStart,
            materials,
            possession: possessionRef.current,
            itemsById,
            servantsById,
            setPossession,
          }),
    [trackingMode, materials, servantsById, itemsById, setPossession, possessionRef]
  )

  const applyStartChange = useCallback(
    (servantId: string, target: TargetKey, idx: number, prevStart: number, newStart: number) => {
      if (!trackingMode || servantId === 'all' || prevStart === newStart) return
      executeStartApply({
        servantId,
        target,
        idx,
        prevStart,
        newStart,
        materials,
        itemsById,
        servantsById,
        setPossession,
      })
    },
    [trackingMode, materials, setPossession, servantsById, itemsById]
  )

  return { checkStartChange, applyStartChange }
}

export const useTrackingLedger = (
  options: UseTrackingLedgerOptions
): UseTrackingLedgerReturn => {
  const { materials, servantsById, itemsById } = options
  const {
    trackingMode,
    setTrackingMode,
    trackingDismissed,
    setTrackingDismissed,
    possession,
    setPossession,
  } = useTrackingStorage()

  const possessionRef = useRef(possession)
  useEffect(() => {
    possessionRef.current = possession
  }, [possession])

  const hasPossessionInput = usePossessionHistory(possession)

  const { checkStartChange, applyStartChange } = useTrackingCallbacks({
    trackingMode,
    materials,
    possessionRef,
    itemsById,
    servantsById,
    setPossession,
  })

  return {
    trackingMode,
    setTrackingMode,
    trackingDismissed,
    setTrackingDismissed,
    possession,
    setPossession,
    hasPossessionInput,
    checkStartChange,
    applyStartChange,
  }
}
