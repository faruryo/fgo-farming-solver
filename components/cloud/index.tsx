'use client'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { signOut } from 'next-auth/react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthButton } from '../common/auth-button'
import { getStats } from './parts/stats-logic'
import { ComparisonView } from './parts/comparison-view'
import { ShrinkDiff } from './parts/shrink-diff'
import { LocalSection } from './parts/local-section'
import { useCloudSync, KEYS, CloudData, MOCK_CLOUD_KEY } from '../../hooks/use-cloud-sync'
import { normalizeCloudResponse } from '../../lib/cloud-sync/parse'
import { formatDate } from '../../lib/format-date'
import type { PayloadScale } from '../../lib/cloud-sync/shrink-guard'

// 「保存しようとした内容」は、いまこの端末の localStorage そのもの。保留中の保存は
// まだ送られていないので、クラウドと突き合わせる相手はこれで正しい。SSR では読めない
// ため空を返すが、保留パネル自体がクライアントでしか描画されないので実害はない。
const localStorageSnapshot = (): Record<string, string | null> =>
  Object.fromEntries(
    KEYS.map((key) => [
      key,
      typeof window === 'undefined' ? null : localStorage.getItem(key),
    ])
  )

const Cloud = () => {
  const { t } = useTranslation('common')
  const {
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
    isInitializing,
    autoSyncEnabled,
    toggleAutoSync,
    hasConflict,
    blockedShrink,
    resolveShrinkByRestore,
    resolveShrinkByForce,
    items
  } = useCloudSync()

  // 縮小ガードで保存が止まっている状態。conflict と同時に立ちうる(コンフリクト中に
  // 「クラウドを強制上書き」を押すと、その保存がガードに掛かる)。そのときは保存が
  // 実際にブロックされているこちらを優先して出す。conflict 単独時の表示・文言は従来
  // どおりで変わらない。
  const isShrinkBlocked = blockedShrink != null
  const isAlert = isShrinkBlocked || hasConflict

  // クラウド側が読めなかったときは件数を出せない。0 と偽らず「読み取れません」と書く
  // (shrink-guard-dialog と同じ表記)。
  const summarizeScale = (scale: PayloadScale | null) =>
    scale == null
      ? t('shrink-guard-unknown', '読み取れません')
      : `${t('shrink-guard-servants', 'サーヴァント')} ${scale.servants} / ${t('shrink-guard-possessions', '所持素材の種類')} ${scale.possessions}`

  // クラウドのデータが「いつ・どの端末から」保存されたものかは、復元するかどうかの
  // 判断に直結する(端末間で保存が往復していた事故は、この 2 つで特定できた)。
  // 生の ISO は読みづらいので、既存の formatDate(JST 表記)に合わせる。
  const cloudSavedAt = (() => {
    const raw = cloudData?.metadata?.updatedAt
    const time = raw ? new Date(raw).getTime() : NaN
    // updatedAt を持たない古いデータには epoch(0) が入るため、日時として出さない。
    if (!Number.isFinite(time) || time <= 0) return null
    return formatDate(raw)
  })()

  const [isDiffOpen, setIsDiffOpen] = useState(false)
  const onDiffOpen = () => setIsDiffOpen(true)
  const onDiffClose = () => setIsDiffOpen(false)
  const [modalMode, setModalMode] = useState<'load' | 'save'>('load')
  const [pendingCloudData, setPendingCloudData] = useState<CloudData | null>(null)

  const handleLoad = async () => {
    setIsLoading(true)
    setModalMode('load')
    try {
      let data: CloudData | null = null

      if (session != null) {
        const res = await fetch(`/api/cloud`, { credentials: 'include' })
        const rawData = await res.json()
        data = normalizeCloudResponse(rawData)
      } else if (process.env.NODE_ENV === 'development') {
        const mock = localStorage.getItem(MOCK_CLOUD_KEY)
        if (mock) data = JSON.parse(mock)
      }

      if (!data || Object.keys(data.storage).length === 0) return

      setPendingCloudData(data)
      onDiffOpen()
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  const handleManualSave = async () => {
    if (hasConflict) {
      // Show diff for force overwrite
      setModalMode('save')
      setPendingCloudData(cloudData)
      onDiffOpen()
    } else {
      await handleSave()
    }
  }

  const confirmAction = () => {
    if (modalMode === 'load') {
      if (!pendingCloudData) return
      applyData(pendingCloudData.storage, pendingCloudData.metadata)
    } else {
      void handleSave(true)
    }
    onDiffClose()
  }

  const comparisonStats = modalMode === 'load' 
    ? (pendingCloudData ? getStats(pendingCloudData.storage, items) : null)
    : (cloudData ? getStats(cloudData.storage, items) : null)

  const exportLocal = () => {
    const entries = KEYS.map((key) => [key, localStorage.getItem(key)] as const)
    const data = Object.fromEntries(entries.filter(([, value]) => value))
    const backup = {
      metadata: {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        app: 'fgo-farming-solver'
      },
      storage: data
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fgo_farming_backup_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="c-page-header">
          <div>
            <div className="c-page-en">DATA MANAGEMENT</div>
            <h1 className="c-page-title">{t('クラウドセーブ')} & {t('local-backup-title')}</h1>
          </div>
        </div>

        <div className="flex flex-col items-center gap-8 py-8">
          {/* Cloud Sync Section */}
          <div className="c-card max-w-[600px] w-full p-8" style={{ border: isAlert ? '1px solid var(--red)' : '1px solid var(--border)' }}>
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ background: isAlert ? 'rgba(255,0,0,0.1)' : 'rgba(154,114,36,0.1)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isAlert ? 'var(--red)' : 'var(--gold)'} strokeWidth="2">
                    <path d="M17.5 19c.7 0 1.3-.2 1.8-.7.5-.5.7-1.1.7-1.8 0-.5-.1-.9-.4-1.3-.2-.4-.6-.7-1-.9 0-.1 0-.2.1-.3 0-1.4-.5-2.6-1.5-3.5-1-.9-2.1-1.4-3.5-1.4-.9 0-1.8.2-2.6.7-.8.5-1.4 1.1-1.8 1.9-.3-.1-.6-.2-.9-.2-1.1 0-2.1.4-2.8 1.2s-1.1 1.7-1.1 2.8c0 1.1.4 2.1 1.2 2.8.8.8 1.7 1.2 2.8 1.2h10z" />
                  </svg>
                </div>
                <p className="font-bold" style={{ color: isAlert ? 'var(--red)' : 'var(--gold)' }}>
                  {isShrinkBlocked
                    ? t('shrink-guard-blocked-title', '保存を中断しています')
                    : hasConflict ? 'Sync Conflict Detected' : 'Cloud Sync'}
                </p>
              </div>

              {isShrinkBlocked ? (
                <div className="flex flex-col gap-2 p-4 rounded-xl" style={{ background: 'rgba(255,0,0,0.05)' }}>
                  <p className="text-sm font-bold" style={{ color: 'var(--red)' }}>
                    {t('shrink-guard-title', 'クラウドのデータが大きく減ります')}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text2)' }}>
                    {t(
                      'shrink-guard-blocked-description',
                      'クラウドのデータが大きく減る保存を止めています。解決するまで自動保存は止まったままです。下の件数を見比べて、クラウドから読み込むか、このまま保存するかを選んでください。',
                    )}
                  </p>
                </div>
              ) : hasConflict ? (
                <div className="flex flex-col gap-2 p-4 rounded-xl" style={{ background: 'rgba(255,0,0,0.05)' }}>
                  <p className="text-sm font-bold" style={{ color: 'var(--red)' }}>{t('cloud-conflict-title', 'クラウドに新しいデータがあります')}</p>
                  <p className="text-xs" style={{ color: 'var(--text2)' }}>
                    {t('cloud-conflict-description', 'この端末のデータは、クラウドに保存されているデータより古い状態です（他の端末で更新された可能性があります）。新しいデータを上書きしないよう、自動保存を停止しています。「読み込み」でクラウドのデータを取り込んでください。')}
                  </p>
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text2)' }}>{t('cloud-description')}</p>
              )}

              {(session != null || (process.env.NODE_ENV === 'development' && cloudData)) && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(154,114,36,0.04)', border: '1px solid rgba(154,114,36,0.1)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: '#60c890' }}></div>
                      <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                        {session?.user?.name || 'Local Dev User'}
                      </p>
                    </div>
                    {session?.user?.email && (
                      <p className="text-[10px] pl-5" style={{ color: 'var(--text2)' }}>
                        {session.user.email}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center px-1">
                    <label htmlFor="auto-sync" className="text-sm flex-1 cursor-pointer" style={{ color: 'var(--text2)' }}>
                      {t('auto-sync-label', 'クラウド同期を自動化する')}
                    </label>
                    <Switch
                      id="auto-sync"
                      checked={autoSyncEnabled}
                      // 保留中は自動保存が実際に止まっている。切り替えても状況は変わらず
                      // 誤解を招くだけなので、conflict と同じく操作させない。
                      disabled={isAlert}
                      onCheckedChange={() => toggleAutoSync()}
                      size="sm"
                      className="gold-switch"
                    />
                  </div>
                </div>
              )}

              {isInitializing || (session != null && !cloudData && !isLoading) || isLoading ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 className="animate-spin h-4 w-4" style={{ color: 'var(--gold)' }} />
                  <p className="text-xs" style={{ color: 'var(--text2)' }}>
                    {isLoading ? t('読み込み中...') : t('checking-sync-status', '同期状態を確認しています...')}
                  </p>
                </div>
              ) : session == null && !(process.env.NODE_ENV === 'development' && cloudData) ? (
                <div className="flex justify-center pt-4">
                  <AuthButton />
                </div>
              ) : (
                <div className="flex flex-col gap-6 w-full">
                  {isShrinkBlocked ? (
                    <div className="flex flex-col gap-4 w-full">
                      {/* ダイアログより判断材料を増やす場所。ガードの「判定」は items
                          カタログに依存しない measurePayload の件数で行う(items 未ロード
                          時に両側 0 になって素通りするのを防ぐため)が、ここは判定に一切
                          影響しない「表示」なので、getStats 由来のより細かい数字
                          (スキル合計・素材のレア度別合計)を出してよい。localStats /
                          cloudStats が取れないときは下の件数カードだけにフォールバックする。
                          ガードがクラウドを読めなかった(blockedShrink.cloud == null)ときも
                          「読み取れません」と数字が並んで矛盾するので出さない。 */}
                      {localStats != null && cloudStats != null && blockedShrink.cloud != null && (
                        <ComparisonView localStats={localStats} cloudStats={cloudStats} show={true} />
                      )}

                      {/* 止めた保存とクラウドの現況をその場で見比べられるようにする。
                          ComparisonView は localStorage 由来の Stats 専用で、止めた
                          ペイロードの件数(PayloadScale)も cloud=null も表せないため、
                          pendingShrink の値を直接並べる。 */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl p-3" style={{ border: '1px solid var(--border)' }}>
                          <div className="mb-1 font-medium" style={{ color: 'var(--text2)' }}>
                            {t('shrink-guard-next', '保存しようとした内容')}
                          </div>
                          <div style={{ color: 'var(--text)' }}>{summarizeScale(blockedShrink.next)}</div>
                        </div>
                        <div className="rounded-xl p-3" style={{ border: '1px solid var(--border)' }}>
                          <div className="mb-1 font-medium" style={{ color: 'var(--text2)' }}>
                            {t('shrink-guard-cloud', 'クラウド')}
                          </div>
                          <div style={{ color: 'var(--text)' }}>{summarizeScale(blockedShrink.cloud)}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl p-3" style={{ border: '1px solid var(--border)' }}>
                          <div className="mb-1 font-medium" style={{ color: 'var(--text2)' }}>
                            {t('shrink-guard-cloud-saved-at', 'クラウドの最終保存')}
                          </div>
                          <div style={{ color: 'var(--text)' }}>
                            {cloudSavedAt ?? t('shrink-guard-unknown', '読み取れません')}
                          </div>
                        </div>
                        <div className="rounded-xl p-3" style={{ border: '1px solid var(--border)' }}>
                          <div className="mb-1 font-medium" style={{ color: 'var(--text2)' }}>
                            {t('shrink-guard-cloud-device', '保存した端末')}
                          </div>
                          <div className="break-all" style={{ color: 'var(--text)' }}>
                            {cloudData?.metadata?.deviceId || t('shrink-guard-unknown', '読み取れません')}
                          </div>
                        </div>
                      </div>

                      {blockedShrink.missingKeys.length > 0 && (
                        <div className="rounded-xl p-3 text-xs" style={{ border: '1px solid var(--border)', color: 'var(--text2)' }}>
                          {t('shrink-guard-missing-keys', '保存内容から消えている項目')}{' '}
                          {blockedShrink.missingKeys.length}
                          {/* /cloud は場所に余裕があるので、件数だけでなくキー名まで出す。 */}
                          <div className="mt-1 break-all" style={{ color: 'var(--text)' }}>
                            {blockedShrink.missingKeys.join(', ')}
                          </div>
                        </div>
                      )}

                      {/* 集計値だけでは 461→0 の中身が分からない。どの素材がいくつ
                          減り、どのキーが消えるのかまで出して初めて「見比べる」が
                          判断材料になる。表示専用でガードの判定には関与しない。 */}
                      {cloudData != null && (
                        <ShrinkDiff
                          next={localStorageSnapshot()}
                          cloud={cloudData.storage}
                          keys={KEYS}
                          items={items}
                        />
                      )}

                      <div className="flex flex-col sm:flex-row gap-3 w-full">
                        <Button
                          className="flex-1 h-11 text-sm"
                          variant="outline"
                          style={{ borderColor: 'var(--gold-dim)', color: 'var(--gold)' }}
                          onClick={resolveShrinkByRestore}
                        >
                          {t('読み込み')}
                        </Button>
                        <Button
                          className="flex-1 h-11 text-sm"
                          variant="destructive"
                          onClick={() => void resolveShrinkByForce()}
                          disabled={isSaving}
                        >
                          {isSaving && <Loader2 className="animate-spin h-3 w-3 mr-1" />}
                          {t('shrink-guard-force', 'このまま保存する')}
                        </Button>
                      </div>
                    </div>
                  ) : hasConflict ? (
                    <div className="flex flex-col sm:flex-row gap-3 w-full">
                      <Button
                        className="flex-1 h-11 text-sm"
                        variant="outline"
                        style={{ borderColor: 'var(--gold-dim)', color: 'var(--gold)' }}
                        onClick={handleLoad}
                        disabled={isLoading || !cloudData || Object.keys(cloudData.storage).length === 0}
                      >
                        {isLoading && <Loader2 className="animate-spin h-3 w-3 mr-1" />}
                        {t('読み込み')}
                      </Button>
                      <Button
                        className="flex-1 h-11 text-sm"
                        variant="destructive"
                        onClick={handleManualSave}
                        disabled={isSaving || saveStatus === true}
                      >
                        {isSaving && <Loader2 className="animate-spin h-3 w-3 mr-1" />}
                        {t('cloud-force-overwrite', 'クラウドを強制上書き')}
                      </Button>
                    </div>
                  ) : (
                    <div className="w-full p-4 rounded-xl" style={{ background: autoSyncEnabled ? 'rgba(154,114,36,0.05)' : 'rgba(255,255,255,0.02)', border: '1px dashed var(--gold-dim)' }}>
                      <div className="flex items-center gap-3">
                        {autoSyncEnabled ? (
                          <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                              <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            <p className="font-bold" style={{ fontSize: '14px', color: 'var(--gold)' }}>{t('cloud-sync-healthy', 'クラウドとの同期は正常です')}</p>
                          </>
                        ) : (
                          <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <p style={{ fontSize: '14px', color: 'var(--text2)' }}>{t('cloud-auto-sync-stopped', '自動同期が停止しています')}</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {session != null && (
                    <Button
                      variant="ghost"
                      size="sm"
                      style={{ color: 'rgba(180,210,240,0.5)' }}
                      onClick={() => signOut()}
                    >
                      {t('サインアウト')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          <LocalSection exportLocal={exportLocal} />
        </div>

        <Dialog open={isDiffOpen} onOpenChange={(open) => !open && onDiffClose()}>
          <DialogContent
            className="max-w-xl overflow-y-auto max-h-[80vh] rounded-[20px]"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          >
            <DialogHeader>
              <DialogTitle style={{ color: 'var(--gold)' }}>
                {modalMode === 'load' ? t('data-comparison') : t('cloud-overwrite-confirm-title', 'クラウド上書きの確認')}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-6">
              <p className="text-sm" style={{ color: 'var(--text2)' }}>
                {modalMode === 'load'
                  ? t('cloud-load-confirm-message')
                  : t('cloud-overwrite-confirm-message', 'クラウドにある新しいデータを、現在のローカルデータで強制的に上書きします。よろしいですか？')}
              </p>
              <ComparisonView
                localStats={localStats!}
                cloudStats={comparisonStats!}
                show={true}
              />
            </div>
            <DialogFooter className="gap-3">
              <Button variant="ghost" onClick={onDiffClose}>{t('キャンセル')}</Button>
              <Button
                variant={modalMode === 'load' ? 'default' : 'destructive'}
                onClick={confirmAction}
              >
                {modalMode === 'load' ? t('データを適用する') : 'クラウドを上書きする'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default Cloud
