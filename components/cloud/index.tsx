'use client'

import { 
  Button, 
  HStack, 
  Text, 
  VStack, 
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Center,
  Switch,
  FormControl,
  FormLabel,
  Box,
  Stack
} from '@chakra-ui/react'
import { signOut } from 'next-auth/react'
import { useState } from 'react'
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

  const { isOpen: isDiffOpen, onOpen: onDiffOpen, onClose: onDiffClose } = useDisclosure()
  const [modalMode, setModalMode] = useState<'load' | 'save'>('load')
  const [pendingCloudData, setPendingCloudData] = useState<CloudData | null>(null)

  const handleLoad = async () => {
    setIsLoading(true)
    setModalMode('load')
    try {
      let data: CloudData | null = null

      if (session != null) {
        const res = await fetch(`/api/cloud`, { credentials: 'include' })
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
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

        <VStack spacing={8} py={8}>
          {/* Cloud Sync Section */}
          <div className="c-card" style={{ 
            maxWidth: '600px', 
            width: '100%', 
            padding: '32px',
            border: hasConflict ? '1px solid var(--red)' : '1px solid var(--border)' 
          }}>
            <VStack spacing={6} align="stretch">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '8px', background: hasConflict ? 'rgba(255,0,0,0.1)' : 'rgba(154,114,36,0.1)', borderRadius: '8px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={hasConflict ? 'var(--red)' : 'var(--gold)'} strokeWidth="2">
                    <path d="M17.5 19c.7 0 1.3-.2 1.8-.7.5-.5.7-1.1.7-1.8 0-.5-.1-.9-.4-1.3-.2-.4-.6-.7-1-.9 0-.1 0-.2.1-.3 0-1.4-.5-2.6-1.5-3.5-1-.9-2.1-1.4-3.5-1.4-.9 0-1.8.2-2.6.7-.8.5-1.4 1.1-1.8 1.9-.3-.1-.6-.2-.9-.2-1.1 0-2.1.4-2.8 1.2s-1.1 1.7-1.1 2.8c0 1.1.4 2.1 1.2 2.8.8.8 1.7 1.2 2.8 1.2h10z" />
                  </svg>
                </div>
                <Text fontWeight="bold" color={hasConflict ? 'var(--red)' : 'var(--gold)'}>
                  {hasConflict ? 'Sync Conflict Detected' : 'Cloud Sync'}
                </Text>
              </div>
              
              {hasConflict ? (
                <VStack align="stretch" spacing={2} p={4} bg="rgba(255,0,0,0.05)" borderRadius="12px">
                  <Text color="var(--red)" fontSize="sm" fontWeight="bold">Cloud contains newer data.</Text>
                  <Text color="var(--text2)" fontSize="xs">
                    Your local data is older than the data stored in the cloud (possibly from another device). 
                    Auto-save is suspended to prevent overwriting newer progress. 
                    Please &quot;Load&quot; from cloud to synchronize.
                  </Text>
                </VStack>
              ) : (
                <Text color="var(--text2)" fontSize="sm">{t('cloud-description')}</Text>
              )}

              {(session != null || (process.env.NODE_ENV === 'development' && cloudData)) && (
                <VStack spacing={4} align="stretch">
                  <VStack spacing={2} align="stretch" px={4} py={3} background="rgba(154,114,36,0.04)" borderRadius="12px" border="1px solid rgba(154,114,36,0.1)">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#60c890' }}></div>
                      <Text fontSize="xs" color="var(--text)" fontWeight="500">
                        {session?.user?.name || 'Local Dev User'}
                      </Text>
                    </div>
                  </VStack>

                  <FormControl display="flex" alignItems="center" px={1}>
                    <FormLabel htmlFor="auto-sync" mb="0" fontSize="sm" color="var(--text2)" flex="1">
                      {t('auto-sync-label', 'クラウド同期を自動化する')}
                    </FormLabel>
                    <Switch 
                      id="auto-sync" 
                      isChecked={autoSyncEnabled} 
                      isDisabled={hasConflict}
                      onChange={toggleAutoSync} 
                      colorScheme="gold" 
                      size="sm" 
                      sx={{
                        'span.chakra-switch__track:not([data-checked])': {
                          bg: 'rgba(154,114,36,0.2)',
                        },
                      }}
                    />
                  </FormControl>
                </VStack>
              )}

              {isInitializing || (session != null && !cloudData && !isLoading) || isLoading ? (
                <Center py={4}>
                  <VStack spacing={3}>
                    <Spinner size="sm" color="var(--gold)" />
                    <Text fontSize="xs" color="var(--text2)">
                      {isLoading ? t('読み込み中...') : 'Checking sync status...'}
                    </Text>
                  </VStack>
                </Center>
              ) : session == null && process.env.NODE_ENV !== 'development' ? (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '16px' }}>
                  <AuthButton />
                </div>
              ) : (
                <VStack spacing={6} width="100%">
                  {hasConflict ? (
                    <Stack direction={{ base: 'column', sm: 'row' }} spacing={3} width="100%">
                      <Button
                        flex={1}
                        height="44px"
                        variant="outline"
                        borderColor="var(--gold-dim)"
                        color="var(--gold)"
                        fontSize="14px"
                        onClick={handleLoad}
                        isLoading={isLoading}
                        isDisabled={!cloudData || Object.keys(cloudData.storage).length === 0}
                        _hover={{ bg: 'rgba(154,114,36,0.05)' }}
                      >
                        {t('読み込み')}
                      </Button>
                      <Button
                        flex={1}
                        height="44px"
                        colorScheme="red"
                        variant="solid"
                        borderColor="var(--red)"
                        color="var(--bg)"
                        fontSize="14px"
                        onClick={handleManualSave}
                        isLoading={isSaving}
                        isDisabled={saveStatus === true}
                      >
                        クラウドを強制上書き
                      </Button>
                    </Stack>
                  ) : (
                    <Box w="100%" p={4} bg={autoSyncEnabled ? "rgba(154,114,36,0.05)" : "rgba(255,255,255,0.02)"} borderRadius="12px" border="1px dashed var(--gold-dim)">
                      <HStack spacing={3}>
                        {autoSyncEnabled ? (
                          <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                              <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            <Text fontSize="14px" color="var(--gold)" fontWeight="bold">
                              クラウドとの同期は正常です
                            </Text>
                          </>
                        ) : (
                          <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <Text fontSize="14px" color="var(--text2)">
                              自動同期が停止しています
                            </Text>
                          </>
                        )}
                      </HStack>
                    </Box>
                  )}
                  {session != null && (
                    <Button
                      variant="ghost"
                      size="xs"
                      color="rgba(180,210,240,0.5)"
                      onClick={() => signOut()}
                      _hover={{ color: 'var(--red)', bg: 'rgba(176,48,48,0.05)' }}
                    >
                      {t('サインアウト')}
                    </Button>
                  )}
                </VStack>
              )}
            </VStack>
          </div>

          <LocalSection exportLocal={exportLocal} />
        </VStack>

        <Modal isOpen={isDiffOpen} onClose={onDiffClose} size="xl" scrollBehavior="inside">
          <ModalOverlay backdropFilter="blur(4px)" />
          <ModalContent background="var(--bg)" border="1px solid var(--border)" borderRadius="20px">
            <ModalHeader color="var(--gold)">
              {modalMode === 'load' ? t('data-comparison') : 'クラウド上書きの確認'}
            </ModalHeader>
            <ModalBody>
              <VStack spacing={6} align="stretch">
                <Text fontSize="sm" color="var(--text2)">
                  {modalMode === 'load' 
                    ? t('cloud-load-confirm-message') 
                    : 'クラウドにある新しいデータを、現在のローカルデータで強制的に上書きします。よろしいですか？'}
                </Text>
                <ComparisonView 
                  localStats={localStats!} 
                  cloudStats={comparisonStats!} 
                  show={true}
                />
              </VStack>
            </ModalBody>
            <ModalFooter gap={3}>
              <Button variant="ghost" onClick={onDiffClose}>{t('キャンセル')}</Button>
              <Button 
                colorScheme={modalMode === 'load' ? 'gold' : 'red'} 
                onClick={confirmAction}
              >
                {modalMode === 'load' ? t('データを適用する') : 'クラウドを上書きする'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </div>
  )
}

export default Cloud
