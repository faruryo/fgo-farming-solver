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
  createInitialLocalMetadata,
  decideSyncAction,
  isInitialSyncMetadata,
  isResumeTrigger,
  markDirty,
  metadataAfterApply,
  metadataAfterSave,
  normalizeLocalMetadata,
  shouldRefetchOnResume,
} from '../lib/cloud-sync/decision'
import {
  MISSING_KEYS_THRESHOLD,
  PayloadScale,
  findMissingKeys,
  isDestructiveShrink,
  measurePayload,
} from '../lib/cloud-sync/shrink-guard'

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
  'masterLevel',
  'todoState',
  'todoSettings',
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

// 縮小ガードで止めた保存。ダイアログの提示と autosave の抑止に使う。
export type PendingShrink = {
  // 保存しようとした規模
  next: PayloadScale
  // クラウドの現況。クラウド側が読めなかった場合は null(件数を出せない)
  cloud: PayloadScale | null
  // クラウドにあって保存内容に無いキー
  missingKeys: string[]
  // 止めた保存が持っていた force(コンフリクトのバイパス)。「このまま保存する」は
  // これをそのまま再現する。false 固定にすると /cloud の強制上書き経由の解決が
  // handleSave 冒頭のコンフリクト中断で黙って何もしないまま終わる。
  force: boolean
}

// pending もモジュールスコープ。フックは nav・/cloud など複数箇所からマウント
// されるため、インスタンス state では他インスタンスの autosave を止められない。
let pendingShrink: PendingShrink | null = null
// ダイアログを閉じただけの状態。pending は残し、次の編集で出し直す。
let isShrinkDialogDismissed = false

export const SHRINK_GUARD_EVENT = 'fgo-shrink-guard-update'

const notifyShrinkChange = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(SHRINK_GUARD_EVENT))
}

const setPendingShrink = (next: PendingShrink | null) => {
  pendingShrink = next
  isShrinkDialogDismissed = false
  notifyShrinkChange()
}

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
  const [isDivergent, setIsDivergent] = useState(false)
  const [pendingShrinkState, setPendingShrinkState] = useState<PendingShrink | null>(null)
  // ダイアログの開閉と無関係に「保存が止まっている」ことを表す。/cloud の見比べ画面へは
  // ダイアログの「見比べる」= dismiss を経由して来るため、dismiss で null になる
  // pendingShrink を見ていると遷移先が素通しになる(保留中なのに「同期は正常です」)。
  const [blockedShrinkState, setBlockedShrinkState] = useState<PendingShrink | null>(null)

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // handleSave から同期的に読む最新のクラウド内容。state を handleSave の deps に
  // 入れると、変更リスナーの effect が張り直されて cleanup が武装済みの autosave
  // タイマーを取り消してしまう(再スケジュールされない)ため ref で持つ。
  const cloudDataRef = useRef<CloudData | null>(null)

  // pending の変更を全インスタンスへ伝播させる
  useEffect(() => {
    const sync = () => {
      setPendingShrinkState(isShrinkDialogDismissed ? null : pendingShrink)
      setBlockedShrinkState(pendingShrink)
    }
    sync()
    window.addEventListener(SHRINK_GUARD_EVENT, sync)
    return () => window.removeEventListener(SHRINK_GUARD_EVENT, sync)
  }, [])

  // Local metadata tracking
  const getLocalMetadata = useCallback((): LocalMetadata => {
    if (typeof window === 'undefined') return createInitialLocalMetadata('server')
    const raw = localStorage.getItem(LOCAL_METADATA_KEY)
    if (raw) {
      const stored = JSON.parse(raw) as unknown as LocalMetadata
      const normalized = normalizeLocalMetadata(stored)
      if (normalized !== stored) {
        localStorage.setItem(LOCAL_METADATA_KEY, JSON.stringify(normalized))
      }
      return normalized
    }

    // A new device starts clean at epoch. This lets a newer cloud save restore
    // safely while a later real edit still breaks updatedAt === lastSyncedAt.
    const meta = createInitialLocalMetadata(
      Math.random().toString(36).substring(2, 10)
    )
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
      setIsDivergent(false)
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
    const local = getLocalMetadata()
    const cloudHasData = KEYS.some((key) => typeof cloud.storage[key] === 'string')
    const action = decideSyncAction(local, cloud.metadata, cloudHasData)
    // divergent も解決が必要な状態なので、バナーと autosave 中断は conflict と同じ
    // 扱いにする。区別が要るのは選択モーダルを出すかどうかだけ。
    setHasConflict(action === 'conflict' || action === 'divergent')
    setIsDivergent(action === 'divergent')
    // First-device restore is safe even before this device has opted into
    // ongoing auto-sync. Existing devices still respect the local toggle.
    if (
      action === 'auto-apply' &&
      (autoSyncEnabled || isInitialSyncMetadata(local))
    ) {
      console.log('Safe Auto-Load (Sync) triggered')
      applyData(cloud.storage, cloud.metadata)
    }
    return action
  }, [autoSyncEnabled, applyData, getLocalMetadata])

  // 取得した内容を返す。setCloudData は同じレンダーの `cloudData` を更新しないため、
  // 縮小ガードのように「今取った値」で判定したい呼び出し側が戻り値で受け取れるように
  // する(既存の呼び出し側は戻り値を無視するので影響しない)。
  const fetchCloudData = useCallback(async (): Promise<CloudData | null> => {
    // Recorded synchronously at entry so a same-tick burst (multiple hook
    // instances reacting to one resume) merges into a single GET.
    lastCloudFetchAt = Date.now()
    if (session == null) {
      if (process.env.NODE_ENV === 'development') {
        const mock = localStorage.getItem(MOCK_CLOUD_KEY)
        if (mock) {
          const parsed = JSON.parse(mock) as unknown as CloudData
          cloudDataRef.current = parsed
          setCloudData(parsed)
          checkConflict(parsed)
          return parsed
        }
      }
      return null
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
        cloudDataRef.current = parsed
        setCloudData(parsed)
        checkConflict(parsed)
        return parsed
      }
    } catch (e) {
      console.error('Failed to fetch cloud data', e)
    }
    return null
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

  // force はコンフリクトのバイパス(/cloud の「強制上書き」)。縮小ガードの解除は
  // options.allowShrink で別に受ける。同じフラグで兼ねると、クラウドを潰す当の
  // ボタンだけがガードを素通りする。
  const handleSave = useCallback(async (
    force = false,
    options?: { allowShrink?: boolean },
  ) => {
    if (hasConflict && autoSyncEnabled && !force) {
      console.warn('Auto-save aborted due to cloud conflict')
      return
    }

    setIsSaving(true)
    setSaveStatus(false)
    try {
      const entries = KEYS.map((key) => [key, localStorage.getItem(key)] as const)
      const dataObj = Object.fromEntries(entries.filter(([, value]) => value !== null)) as Record<string, string>

      // pushEnabled は端末ローカル専用キー(fgo_push_enabled)に分離済みのため、
      // 過去のクラウドデータに残っていても次回セーブでクラウド側から除去する
      // (openspec/changes/push-settings-isolation design.md Decisions #1)。
      if (typeof dataObj.todoSettings === 'string') {
        try {
          const todoSettings = JSON.parse(dataObj.todoSettings) as Record<string, unknown>
          delete todoSettings.pushEnabled
          dataObj.todoSettings = JSON.stringify(todoSettings)
        } catch (e) {
          console.error('Failed to strip pushEnabled from todoSettings before cloud save', e)
        }
      }

      // 縮小ガード。実際に送る dataObj とクラウドの現況を突き合わせ、一発でごっそり
      // 消える保存だけを止める。
      if (options?.allowShrink !== true) {
        // cloud が空でも GET は {} を返して非 null になるので、null は「クラウドが
        // 空」ではなく「状態が不明」。比較できないから通す、にすると通信が不安定な
        // 端末＝事故と同じ条件でだけガードが無効になる。
        // 未ログイン(開発用モック)は fetchCloudData がモック未作成のとき cloudData を
        // 作らない。最初のモック保存を作れるよう、その場合だけ判定を省く。モックが
        // できて以降は本番と同じ経路を通るので、実機でガードを検証できる。
        const cloud = cloudDataRef.current ?? (session != null ? await fetchCloudData() : null)
        if (cloud == null) {
          if (session != null) {
            console.warn('Cloud save aborted: cloud state is unknown')
            setSaveStatus('failed')
            return
          }
        } else {
          const nextScale = measurePayload(dataObj)
          if (nextScale == null) {
            // 送ろうとしている内容が読めない。何を上書きするのか分からないまま
            // 保存はしない。
            console.warn('Cloud save aborted: payload could not be measured')
            setSaveStatus('failed')
            return
          }
          // クラウド側が読めない場合は件数の比較を諦め、キー欠落だけで判定する。
          // ここで中止すると、既に壊れているクラウドを理由に正常なローカルの保存が
          // 永久に止まり、ユーザーに脱出手段が無くなる。守る対象が読めない以上、
          // 件数で守れるものはもう無い。
          const cloudScale = measurePayload(cloud.storage)
          const missingKeys = findMissingKeys(dataObj, cloud.storage, KEYS)
          const shrunk =
            cloudScale == null
              ? missingKeys.length >= MISSING_KEYS_THRESHOLD
              : isDestructiveShrink(nextScale, cloudScale, missingKeys)
          if (shrunk) {
            console.warn('Cloud save blocked by shrink guard', { nextScale, cloudScale, missingKeys })
            setPendingShrink({ next: nextScale, cloud: cloudScale, missingKeys, force })
            return
          }
        }
      }

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
      setIsDivergent(false)
      await fetchCloudData()
    } catch (e) {
      console.error(e)
      setSaveStatus('failed')
    } finally {
      setIsSaving(false)
    }
  }, [session, fetchCloudData, hasConflict, autoSyncEnabled, getLocalMetadata])

  // クラウドの内容をこの端末へ引き下ろす。ローカルが clean になり、以後の判定は
  // 自然に通る。解除は無条件に行う: ref が無いときに解除を飛ばすと、リロードする
  // まで autosave が止まったままになる。
  const resolveShrinkByRestore = useCallback(() => {
    const cloud = cloudDataRef.current
    setPendingShrink(null)
    if (cloud) applyData(cloud.storage, cloud.metadata)
  }, [applyData])

  // 止めた保存をそのまま通す。force は止めた時の値を再現する(0 固定にすると、
  // コンフリクト中の強制上書き経由では handleSave 冒頭で弾かれて何も起きない)。
  const resolveShrinkByForce = useCallback(async () => {
    const pending = pendingShrink
    setPendingShrink(null)
    await handleSave(pending?.force ?? false, { allowShrink: true })
  }, [handleSave])

  // ダイアログを隠すだけ。pending は残るので autosave は止まったまま、次の編集で
  // 出し直す。
  const dismissShrinkDialog = useCallback(() => {
    isShrinkDialogDismissed = true
    notifyShrinkChange()
  }, [])

  // Track local modifications. Only same-window events: native cross-tab
  // 'storage' events are NOT local modifications — the writing tab maintains
  // the (tab-shared) metadata and schedules its own auto-save, and reacting
  // here would re-mark a cloud apply done in another tab as dirty.
  useEffect(() => {
    const listener = (e: Event) => {
      const detail = e instanceof CustomEvent ? (e.detail as { key?: string; derived?: boolean } | null) : null
      const detailKey = detail?.key
      if (detailKey === LOCAL_METADATA_KEY) return
      // 派生値の再計算(TODO の自動生成など)はユーザーの未同期編集ではない。dirty に
      // すると、新規端末で初期値の直後に走る再計算だけで初回のクラウド復元がコンフリ
      // クト扱いになり、復元されなくなる。
      if (detail?.derived === true) return
      // Allowlist: only keys we actually sync (KEYS) are allowed to mark dirty /
      // trigger autosave — e.g. the device-local `fgo_push_enabled` key must NOT
      // (openspec/changes/push-settings-isolation). Events with no detail.key at
      // all (the bulk 'localStorageUpdated' dispatched by local backup import,
      // which can touch many keys at once) conservatively still mark dirty since
      // we can't tell which keys changed from the event alone.
      if (detailKey !== undefined && !KEYS.includes(detailKey)) return
      // Skip updates triggered by applyData (any instance) to keep
      // updatedAt === lastSyncedAt (clean state)
      if (isApplyingCloudData) return

      const newMeta = markDirty(getLocalMetadata(), new Date().toISOString())
      localStorage.setItem(LOCAL_METADATA_KEY, JSON.stringify(newMeta))

      // 縮小が未解決の間は debounce を再武装しない。解決するまで同じ保存を
      // 繰り返し試みても意味がなく、ダイアログを閉じたまま編集が続くだけになる。
      if (pendingShrink !== null) {
        if (isShrinkDialogDismissed) {
          isShrinkDialogDismissed = false
          notifyShrinkChange()
        }
        return
      }

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
    isDivergent,
    pendingShrink: pendingShrinkState,
    blockedShrink: blockedShrinkState,
    resolveShrinkByRestore,
    resolveShrinkByForce,
    dismissShrinkDialog,
    items
  }
}
