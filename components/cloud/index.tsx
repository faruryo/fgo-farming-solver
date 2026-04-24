'use client'

import { Button, Heading, HStack, Text, VStack } from '@chakra-ui/react'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthButton } from '../common/auth-button'

const keys = [
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

const save = async () => {
  const entries = keys.map((key) => [key, localStorage.getItem(key)] as const)
  const body = JSON.stringify(Object.fromEntries(entries.filter(([, value]) => value)))
  await fetch(`/api/cloud`, { method: 'POST', body, credentials: 'include' })
}

const load = async () => {
  const res = await fetch(`/api/cloud`, { credentials: 'include' })
  if (res.status != 200) {
    throw new Error()
  }
  const obj = await res.json<Record<string, string>>()
  keys.forEach((key) => {
    if (obj[key] != null) {
      localStorage.setItem(key, obj[key])
    }
  })
  window.dispatchEvent(new Event('localStorageUpdated'))
}

const Cloud = () => {
  const { t } = useTranslation('common')
  const { data: session } = useSession()
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaved, setIsSaved] = useState(false as boolean | 'failed')
  const [isLoaded, setIsLoaded] = useState(false as boolean | 'failed')

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="c-page-header">
          <div>
            <div className="c-page-en">CLOUD SYNC</div>
            <h1 className="c-page-title">{t('クラウドセーブ')}</h1>
          </div>
        </div>

        <VStack spacing={12} py={8}>
          <div className="c-card" style={{ maxWidth: '600px', width: '100%', padding: '40px', textAlign: 'center' }}>
            <VStack spacing={6}>
              <Text color="var(--text2)">{t('cloud-description')}</Text>

              {session == null ? (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <AuthButton />
                </div>
              ) : (
                <VStack spacing={6} width="100%">
                  <div style={{ padding: '4px 12px', background: 'rgba(30,46,74,0.05)', borderRadius: '20px' }}>
                    <Text fontSize="sm" color="var(--navy)" fontWeight="bold">
                      {session.user?.name}
                    </Text>
                  </div>
                  <HStack spacing={4} width="100%">
                    <Button
                      flex={1}
                      height="50px"
                      colorScheme="gold"
                      variant="outline"
                      borderColor="var(--gold-dim)"
                      color="var(--gold)"
                      onClick={() => {
                        setIsSaving(true)
                        save()
                          .then(() => setIsSaved(true))
                          .catch(() => setIsSaved('failed'))
                          .finally(() => setIsSaving(false))
                      }}
                      isLoading={isSaving}
                      isDisabled={isSaved !== false}
                    >
                      {t(
                        isSaved === false
                          ? '保存'
                          : isSaved === true
                          ? '保存しました'
                          : '保存に失敗しました'
                      )}
                    </Button>
                    <Button
                      flex={1}
                      height="50px"
                      colorScheme="blue"
                      onClick={() => {
                        setIsLoading(true)
                        load()
                          .then(() => {
                            setIsLoaded(true)
                            router.refresh()
                          })
                          .catch(() => setIsLoaded('failed'))
                          .finally(() => setIsLoading(false))
                      }}
                      isLoading={isLoading}
                      isDisabled={isLoaded !== false}
                    >
                      {t(
                        isLoaded == false
                          ? '読み込み'
                          : isLoaded == true
                          ? '読み込みました'
                          : 'データがありません'
                      )}
                    </Button>
                  </HStack>
                  <Button
                    variant="ghost"
                    size="sm"
                    color="var(--text3)"
                    onClick={() => signOut()}
                    _hover={{ color: 'var(--red)', bg: 'rgba(176,48,48,0.05)' }}
                  >
                    {t('サインアウト')}
                  </Button>
                </VStack>
              )}
            </VStack>
          </div>
        </VStack>
      </div>
    </div>
  )
}

export default Cloud
