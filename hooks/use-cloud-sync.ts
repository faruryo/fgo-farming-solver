'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { EnrichedItem, getItems } from '../lib/get-items'
import { getStats } from '../components/cloud/parts/stats-logic'
import {
  CloudMetadata,
  LocalMetadata,
  decideSyncAction,
  isResumeTrigger,
  markDirty,
  metadataAfterApply,
  metadataAfterSave,
  shouldRefetchOnResume,
} from '../lib/cloud-sync/decision'

export type { LocalMetadata } from '../lib/cloud-sync/decision'

export const KEYS = [
  'material',
  'material/result',
  'posession',
  'input',
  'objective',
  'items',
  'quests',
  'excludedQuests',
  'halfDailyAp',
  'dropMergeMethod',
  'farming/results',
  'dropRateKey',
  'dropRateStyle',
  'efficiency/surplusThreshold',
  'efficiency/stockEnabled',
  'efficiency/stockBuffer',
]

export const MOCK_CLOUD_KEY = 'fgo_mock_cloud_data'
export const AUTO_SYNC_KEY = 'fgo_auto_sync_enabled'
export const LOCAL_METADATA_KEY = 'fgo_sync_metadata'

export type CloudData = {
  storage: Record<string, string>
  metadata: CloudMetadata
}

// Module-scoped (not per-instance refs) because the hook is mounted by
// several components (nav, cloud-indicator, /cloud) while the events it
// reacts to are window-global: a per-instance applying flag would let the
// OTHER instances' modification listeners mark the cloud apply dirty, and a
// per-instance fetch timestamp would multiply resume GETs per instance.
let isApplyingCloudData = false
let lastCloudFetchAt: number | null = null

export const useCloudSync = () => {
  const { data: session } = useSession()
  const { i18n } = useTranslation('common')
  const router = useRouter()
const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<false | true | 'failed'>(false)
  const [cloudData, setCloudData] = useState<CloudData | null>(null)
  const [items, setItems] = useState<EnrichedItem[]>([])
  const [isInitializing, setIsInitializing] = useState(true)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false)
  const [hasConflict, setHasConflict] = useState(false)

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Local metadata tracking
  const getLocalMetadata = useCallback((): LocalMetadata => {
    if (typeof window === 'undefined') return { updatedAt: new Date(0).toISOString(), deviceId: 'server' }
    const raw = localStorage.getItem(LOCAL_METADATA_KEY)
    if (raw) return JSON.parse(raw) as unknown as LocalMetadata

    // Initialize with epoch so cloud data is always recognized as newer on first login
    const meta: LocalMetadata = {
      updatedAt: new Date(0).toISOString(),
      deviceId: Math.random().toString(36).substring(2, 10)
    }
    localStorage.setItem(LOCAL_METADATA_KEY, JSON.stringify(meta))
    return meta
  }, [])

  // Load and sync settings across instances
  useEffect(() => {
    const syncVal = () => {
      const val = localStorage.getItem(AUTO_SYNC_KEY)
      setAutoSyncEnabled(val === 'true')
    }
    syncVal()

    window.addEventListener('storage', syncVal)
    window.addEventListener('fgo-auto-sync-update', syncVal)
    return () => {
      window.removeEventListener('storage', syncVal)
      window.removeEventListener('fgo-auto-sync-update', syncVal)
    }
  }, [])

  const toggleAutoSync = () => {
    const newVal = !autoSyncEnabled
    setAutoSyncEnabled(newVal)
    localStorage.setItem(AUTO_SYNC_KEY, String(newVal))
    // Dispatch custom event for same-window sync
    window.dispatchEvent(new Event('fgo-auto-sync-update'))
  }

  const applyData = useCallback((data: Record<string, string>, metadata: CloudData['metadata']) => {
    isApplyingCloudData = true
    try {
      const appliedKeys = KEYS.filter((key) => typeof data[key] === 'string')
      appliedKeys.forEach((key) => localStorage.setItem(key, data[key]))

      // Sync metadata (resolves conflict, stays clean)
      const newLocalMeta = metadataAfterApply(getLocalMetadata(), metadata)
      localStorage.setItem(LOCAL_METADATA_KEY, JSON.stringify(newLocalMeta))

      setHasConflict(false)
      // Per-key detail so useLocalStorage consumers re-read their key: a
      // detail-less event is ignored by their key filter, and stale live
      // state would silently write the pre-apply data back on the next edit.
      // Dispatched synchronously while isApplyingCloudData is true so the
      // modification listeners (all instances) don't mark this dirty.
      appliedKeys.forEach((key) =>
        window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key } }))
      )
      router.refresh()
    } finally {
      isApplyingCloudData = false
    }
  }, [getLocalMetadata, router])

  const checkConflict = useCallback((cloud: CloudData) => {
    const action = decideSyncAction(getLocalMetadata(), cloud.metadata)
    setHasConflict(action === 'conflict')
    if (action === 'auto-apply' && autoSyncEnabled) {
      console.log('Safe Auto-Load (Sync) triggered')
      applyData(cloud.storage, cloud.metadata)
    }
    return action
  }, [autoSyncEnabled, applyData, getLocalMetadata])

  const fetchCloudData = useCallback(async () => {
    // Recorded synchronously at entry so a same-tick burst (multiple hook
    // instances reacting to one resume) merges into a single GET.
    lastCloudFetchAt = Date.now()
    if (session == null) {
      if (process.env.NODE_ENV === 'development') {
        const mock = localStorage.getItem(MOCK_CLOUD_KEY)
        if (mock) {
          const parsed = JSON.parse(mock) as unknown as CloudData
          setCloudData(parsed)
          checkConflict(parsed)
        }
      }
      return
    }

    try {
      const res = await fetch(`/api/cloud`, { credentials: 'include' })
      if (res.status === 200) {
        const rawData: Record<string, unknown> = await res.json()
        let parsed: CloudData
        if (rawData.metadata && rawData.storage) {
          parsed = rawData as unknown as CloudData
        } else {
          parsed = {
            storage: rawData as unknown as Record<string, string>,
            metadata: { updatedAt: new Date(0).toISOString(), deviceId: 'unknown' }
          }
        }
        setCloudData(parsed)
        checkConflict(parsed)
      }
    } catch (e) {
      console.error('Failed to fetch cloud data', e)
    }
  }, [session, checkConflict])

  useEffect(() => {
    void getItems(i18n.language)
      .then(setItems)
      .finally(() => setIsInitializing(false))
  }, [i18n.language])

  useEffect(() => {
    void fetchCloudData()
  }, [fetchCloudData])

  // Refetch cloud data when the tab is resumed, so updates made on another
  // device while this tab was backgrounded get evaluated (auto-load or
  // conflict) instead of waiting for a full page load.
  const refetchIfStale = useCallback(() => {
    if (!shouldRefetchOnResume(lastCloudFetchAt, Date.now())) return
    void fetchCloudData()
  }, [fetchCloudData])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (isResumeTrigger('visibilitychange', { visibilityState: document.visibilityState })) {
        refetchIfStale()
      }
    }
    const onPageShow = (e: PageTransitionEvent) => {
      if (isResumeTrigger('pageshow', { persisted: e.persisted })) {
        refetchIfStale()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [refetchIfStale])

  const handleSave = useCallback(async (force = false) => {
    if (hasConflict && autoSyncEnabled && !force) {
      console.warn('Auto-save aborted due to cloud conflict')
      return
    }

    setIsSaving(true)
    setSaveStatus(false)
    try {
      const entries = KEYS.map((key) => [key, localStorage.getItem(key)] as const)
      const dataObj = Object.fromEntries(entries.filter(([, value]) => value !== null)) as Record<string, string>
      
      const local = getLocalMetadata()
      const now = new Date().toISOString()
      const newMeta = metadataAfterSave(local, now)

      const payload: CloudData = {
        storage: dataObj,
        metadata: {
          updatedAt: now,
          deviceId: local.deviceId
        }
      }
      const body = JSON.stringify(payload)

      if (session != null) {
        const res = await fetch(`/api/cloud`, { method: 'POST', body, credentials: 'include' })
        if (!res.ok) throw new Error('Failed to save to cloud')
      } else if (process.env.NODE_ENV === 'development') {
        localStorage.setItem(MOCK_CLOUD_KEY, body)
      } else {
        throw new Error('Unauthorized')
      }

      localStorage.setItem(LOCAL_METADATA_KEY, JSON.stringify(newMeta))
      setSaveStatus(true)
      setHasConflict(false)
      await fetchCloudData()
    } catch (e) {
      console.error(e)
      setSaveStatus('failed')
    } finally {
      setIsSaving(false)
    }
  }, [session, fetchCloudData, hasConflict, autoSyncEnabled, getLocalMetadata])

  // Track local modifications. Only same-window events: native cross-tab
  // 'storage' events are NOT local modifications — the writing tab maintains
  // the (tab-shared) metadata and schedules its own auto-save, and reacting
  // here would re-mark a cloud apply done in another tab as dirty.
  useEffect(() => {
    const listener = (e: Event) => {
      if (e instanceof CustomEvent && (e.detail as { key?: string } | null)?.key === LOCAL_METADATA_KEY) return
      // Skip updates triggered by applyData (any instance) to keep
      // updatedAt === lastSyncedAt (clean state)
      if (isApplyingCloudData) return

      const newMeta = markDirty(getLocalMetadata(), new Date().toISOString())
      localStorage.setItem(LOCAL_METADATA_KEY, JSON.stringify(newMeta))

      if (autoSyncEnabled) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = setTimeout(() => {
          void handleSave()
        }, 5000)
      }
    }

    window.addEventListener('localStorageUpdated', listener)
    window.addEventListener('ls-sync', listener)

    return () => {
      window.removeEventListener('localStorageUpdated', listener)
      window.removeEventListener('ls-sync', listener)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [autoSyncEnabled, handleSave, getLocalMetadata])

  const localStats = getStats(
    Object.fromEntries(KEYS.map(k => [k, typeof window !== 'undefined' ? localStorage.getItem(k) : null])),
    items
  )
  const cloudStats = cloudData ? getStats(cloudData.storage, items) : null

  return {
    session,
    cloudData,
    localStats,
    cloudStats,
    isSaving,
    saveStatus,
    isLoading,
    setIsLoading,
    handleSave,
    applyData,
    fetchCloudData,
    isInitializing,
    autoSyncEnabled,
    toggleAutoSync,
    hasConflict,
    items
  }
}
