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
import { LocalSection } from './parts/local-section'
import { useCloudSync, KEYS, CloudData } from '../../hooks/use-cloud-sync'

const Cloud = () => {
  const { t } = useTranslation('common')
  const {
    session,
    cloudData,
    localStats,
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
    items
  } = useCloudSync()

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
         
        const rawData = (await res.json()) as { storage?: Record<string, string>; metadata?: { updatedAt: string; deviceId: string } }
        let parsed: CloudData
        if (rawData.metadata && rawData.storage) {
          parsed = rawData as CloudData
        } else {
          parsed = {
            storage: rawData as Record<string, string>,
            metadata: { updatedAt: new Date(0).toISOString(), deviceId: 'unknown' }
          }
        }
        data = parsed
      } else if (process.env.NODE_ENV === 'development') {
        const mock = localStorage.getItem('fgo_mock_cloud_data')
        if (mock) data = JSON.parse(mock) as unknown as CloudData
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
          <div className="c-card max-w-[600px] w-full p-8" style={{ border: hasConflict ? '1px solid var(--red)' : '1px solid var(--border)' }}>
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ background: hasConflict ? 'rgba(255,0,0,0.1)' : 'rgba(154,114,36,0.1)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={hasConflict ? 'var(--red)' : 'var(--gold)'} strokeWidth="2">
                    <path d="M17.5 19c.7 0 1.3-.2 1.8-.7.5-.5.7-1.1.7-1.8 0-.5-.1-.9-.4-1.3-.2-.4-.6-.7-1-.9 0-.1 0-.2.1-.3 0-1.4-.5-2.6-1.5-3.5-1-.9-2.1-1.4-3.5-1.4-.9 0-1.8.2-2.6.7-.8.5-1.4 1.1-1.8 1.9-.3-.1-.6-.2-.9-.2-1.1 0-2.1.4-2.8 1.2s-1.1 1.7-1.1 2.8c0 1.1.4 2.1 1.2 2.8.8.8 1.7 1.2 2.8 1.2h10z" />
                  </svg>
                </div>
                <p className="font-bold" style={{ color: hasConflict ? 'var(--red)' : 'var(--gold)' }}>
                  {hasConflict ? 'Sync Conflict Detected' : 'Cloud Sync'}
                </p>
              </div>

              {hasConflict ? (
                <div className="flex flex-col gap-2 p-4 rounded-xl" style={{ background: 'rgba(255,0,0,0.05)' }}>
                  <p className="text-sm font-bold" style={{ color: 'var(--red)' }}>Cloud contains newer data.</p>
                  <p className="text-xs" style={{ color: 'var(--text2)' }}>
                    Your local data is older than the data stored in the cloud (possibly from another device).
                    Auto-save is suspended to prevent overwriting newer progress.
                    Please &quot;Load&quot; from cloud to synchronize.
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
                  </div>

                  <div className="flex items-center px-1">
                    <label htmlFor="auto-sync" className="text-sm flex-1 cursor-pointer" style={{ color: 'var(--text2)' }}>
                      {t('auto-sync-label', 'クラウド同期を自動化する')}
                    </label>
                    <Switch
                      id="auto-sync"
                      checked={autoSyncEnabled}
                      disabled={hasConflict}
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
                    {isLoading ? t('読み込み中...') : 'Checking sync status...'}
                  </p>
                </div>
              ) : session == null && process.env.NODE_ENV !== 'development' ? (
                <div className="flex justify-center pt-4">
                  <AuthButton />
                </div>
              ) : (
                <div className="flex flex-col gap-6 w-full">
                  {hasConflict ? (
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
                        クラウドを強制上書き
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
                            <p className="font-bold" style={{ fontSize: '14px', color: 'var(--gold)' }}>クラウドとの同期は正常です</p>
                          </>
                        ) : (
                          <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <p style={{ fontSize: '14px', color: 'var(--text2)' }}>自動同期が停止しています</p>
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
                {modalMode === 'load' ? t('data-comparison') : 'クラウド上書きの確認'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-6">
              <p className="text-sm" style={{ color: 'var(--text2)' }}>
                {modalMode === 'load'
                  ? t('cloud-load-confirm-message')
                  : 'クラウドにある新しいデータを、現在のローカルデータで強制的に上書きします。よろしいですか？'}
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
