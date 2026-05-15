'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { EnrichedItem, getItems } from '../lib/get-items'
import { getStats } from '../components/cloud/parts/stats-logic'

export const KEYS = [
  'material',
  'material/result',
  'posession',
  'input',
  'objective',
  'items',
  'quests',
  'halfDailyAp',
  'dropMergeMethod',
  'farming/results',
  'dropRateKey',
  'dropRateStyle',
]

export const MOCK_CLOUD_KEY = 'fgo_mock_cloud_data'
export const AUTO_SYNC_KEY = 'fgo_auto_sync_enabled'
export const LOCAL_METADATA_KEY = 'fgo_sync_metadata'

export type CloudData = {
  storage: Record<string, string>
  metadata: {
    updatedAt: string
    deviceId: string
  }
}

export type LocalMetadata = {
  updatedAt: string
  deviceId: string
  lastSyncedAt?: string
}

export const useCloudSync = () => {
  const { data: session } = useSession()
  const { i18n, t } = useTranslation('common')
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
  // Prevents the local-modification listener from marking data dirty while applyData is writing
  const isApplyingCloudDataRef = useRef(false)

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

  const applyData = useCallback((data: Record<string, string>, metadata: CloudData['metadata'], silent = false) => {
    isApplyingCloudDataRef.current = true
    try {
      KEYS.forEach((key) => {
        const val = data[key]
        if (typeof val === 'string') {
          localStorage.setItem(key, val)
        }
      })

      // Sync metadata (resolves conflict)
      const local = getLocalMetadata()
      const newLocalMeta: LocalMetadata = {
        updatedAt: metadata.updatedAt,
        deviceId: local.deviceId,
        lastSyncedAt: metadata.updatedAt
      }
      localStorage.setItem(LOCAL_METADATA_KEY, JSON.stringify(newLocalMeta))

      setHasConflict(false)
      window.dispatchEvent(new Event('localStorageUpdated'))
      window.dispatchEvent(new CustomEvent('ls-sync'))
      router.refresh()
    } finally {
      isApplyingCloudDataRef.current = false
    }
  }, [getLocalMetadata, router, t])

  const checkConflict = useCallback((cloud: CloudData) => {
    const local = getLocalMetadata()
    const cloudDate = new Date(cloud.metadata.updatedAt).getTime()
    const localDate = new Date(local.updatedAt).getTime()
    
    // 1. Is cloud newer?
    const isCloudNewer = cloudDate > localDate + 1000
    if (!isCloudNewer) {
      setHasConflict(false)
      return { isCloudNewer: false, isConflict: false }
    }

    // 2. Is it a real conflict (dirty) or safe to auto-load (clean)?
    const isLocalClean = local.updatedAt === local.lastSyncedAt
    const isConflict = !isLocalClean && cloud.metadata.deviceId !== local.deviceId

    if (isConflict) {
      setHasConflict(true)
    } else {
      setHasConflict(false)
      // Auto-load if enabled and safe
      if (autoSyncEnabled && isCloudNewer) {
        console.log('Safe Auto-Load (Sync) triggered')
        applyData(cloud.storage, cloud.metadata, true)
      }
    }

    return { isCloudNewer, isConflict }
  }, [autoSyncEnabled, applyData, getLocalMetadata, t])

  const fetchCloudData = useCallback(async () => {
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
      const newMeta: LocalMetadata = {
        ...local,
        updatedAt: now,
        lastSyncedAt: now
      }
      
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

  // Track local modifications
  useEffect(() => {
    const listener = (e: Event) => {
      if (e instanceof CustomEvent && (e.detail as { key?: string } | null)?.key === LOCAL_METADATA_KEY) return
      // Skip updates triggered by applyData to keep updatedAt === lastSyncedAt (clean state)
      if (isApplyingCloudDataRef.current) return

      const meta = getLocalMetadata()
      const newMeta = { ...meta, updatedAt: new Date().toISOString() }
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
    window.addEventListener('storage', listener)
    
    return () => {
      window.removeEventListener('localStorageUpdated', listener)
      window.removeEventListener('ls-sync', listener)
      window.removeEventListener('storage', listener)
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
