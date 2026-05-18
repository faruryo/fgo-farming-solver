import { toast } from 'sonner'
import { createElement } from 'react'
import { TargetKey, Item } from '../interfaces/atlas-academy'
import { ReducedMaterialsRecord } from './get-materials'
import { diffMaterialsForStartChange, MaterialDelta } from './diff-materials'
import {
  TrackingToast,
  TrackingToastItem,
  BlockedToast,
  BlockedToastItem,
} from '../components/material/tracking-toast'

// ── Coalescing window ─────────────────────────────────────────────────────

type CoalesceEntry = {
  firstPrev: number
  expiresAt: number
}

const coalesceWindow = new Map<string, CoalesceEntry>()
const COALESCE_MS = 1000

export const targetLabel = (target: TargetKey, idx: number): string => {
  if (target === 'ascension') return '再臨'
  if (target === 'skill') return `スキル${idx + 1}`
  return `アペンド${idx + 1}`
}

const coalesceKey = (servantId: string, target: TargetKey, idx: number) =>
  `${servantId}:${target}:${idx}`

export const resetCoalesceWindow = () => coalesceWindow.clear()

// ── Tracking toast (消費 / 返還) ──────────────────────────────────────────

export type ShowTrackingToastParams = {
  servantId: string
  servantName: string
  servantMaterials: ReducedMaterialsRecord
  target: TargetKey
  idx: number
  prevStart: number
  newStart: number
  itemsById: Record<string, Item>
}

export const showTrackingToast = (params: ShowTrackingToastParams) => {
  const { servantId, servantName, servantMaterials, target, idx, prevStart, newStart, itemsById } =
    params

  const now = Date.now()
  const key = coalesceKey(servantId, target, idx)
  const existing = coalesceWindow.get(key)
  const effectivePrev =
    existing && existing.expiresAt > now ? existing.firstPrev : prevStart

  coalesceWindow.set(key, { firstPrev: effectivePrev, expiresAt: now + COALESCE_MS })

  const totalDelta: MaterialDelta | null = diffMaterialsForStartChange(
    servantMaterials,
    target,
    effectivePrev,
    newStart
  )

  const toastId = `tracking:${key}`

  if (!totalDelta) {
    toast.dismiss(toastId)
    coalesceWindow.delete(key)
    return
  }

  const items: TrackingToastItem[] = totalDelta.items.map(({ itemId, amount }) => {
    const item = itemsById[itemId]
    return { itemId, name: item?.name ?? itemId, icon: item?.icon, amount }
  })

  const title = `${servantName} ${targetLabel(target, idx)} ${effectivePrev}→${newStart}`

  toast.custom(
    () =>
      createElement(TrackingToast, {
        title,
        direction: totalDelta.direction,
        items,
        onClose: () => toast.dismiss(toastId),
      }),
    { id: toastId, duration: 2500 }
  )
}

// ── Blocked toast (材料不足 + 所持数入力) ─────────────────────────────────

export type ShowBlockedToastParams = {
  servantName: string
  target: TargetKey
  idx: number
  prevStart: number
  newStart: number
  shortageItems: Array<{
    itemId: string
    owned: number
    required: number
    name: string
    icon?: string
  }>
  onSetPossession: (newValues: Record<string, number>) => void
}

export const showBlockedToast = (params: ShowBlockedToastParams) => {
  const { servantName, target, idx, prevStart, newStart, shortageItems, onSetPossession } = params

  // Reuse the same toast id so repeated clicks don't stack
  const toastId = `blocked:${servantName}:${target}:${idx}`

  const title = `${servantName} ${targetLabel(target, idx)} ${prevStart}→${newStart}`

  const items: BlockedToastItem[] = shortageItems.map(({ itemId, name, icon, owned, required }) => ({
    itemId,
    name,
    icon,
    owned,
    required,
  }))

  toast.custom(
    () =>
      createElement(BlockedToast, {
        title,
        items,
        onConfirm: onSetPossession,
        onClose: () => toast.dismiss(toastId),
      }),
    { id: toastId, duration: Infinity }
  )
}
