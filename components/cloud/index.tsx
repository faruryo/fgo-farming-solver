'use client'

import { Button, Heading, HStack, Text, VStack } from '@chakra-ui/react'
import { useSession } from 'next-auth/react'
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
  console.log('[cloud save] localStorage values:')
  entries.forEach(([key, value]) => {
    if (value == null) {
      console.log(`  "${key}": null (missing)`)
    } else if (key === 'material') {
      try {
        const mat = JSON.parse(value) as Record<string, { disabled: boolean }>
        const total = Object.keys(mat).length
        const enabled = Object.values(mat).filter((s) => s?.disabled === false).length
        console.log(`  "${key}": ${total} entries, ${enabled} enabled`)
      } catch {
        console.log(`  "${key}": parse error (length=${value.length})`)
      }
    } else {
      console.log(`  "${key}": ${value.length} chars`)
    }
  })

  const filtered = Object.fromEntries(entries.filter(([, value]) => value))
  console.log('[cloud save] keys to save:', Object.keys(filtered))

  const body = JSON.stringify(filtered)
  const res = await fetch(`/api/cloud`, { method: 'POST', body, credentials: 'include' })
  console.log('[cloud save] API status:', res.status)
}

const load = async () => {
  const res = await fetch(`/api/cloud`, { credentials: 'include' })
  console.log('[cloud load] API status:', res.status)
  if (res.status != 200) {
    throw new Error()
  }
  const obj = await res.json<Record<string, string>>()
  const cloudKeys = Object.keys(obj)
  console.log('[cloud load] keys in cloud:', cloudKeys)

  keys.forEach((key) => {
    if (obj[key] != null) {
      localStorage.setItem(key, obj[key])
      const len = obj[key].length
      console.log(`[cloud load] set "${key}" (${len} chars)`)
    } else {
      console.log(`[cloud load] skip "${key}" (not in cloud)`)
    }
  })

  // Show material summary
  const mat = localStorage.getItem('material')
  if (mat) {
    try {
      const parsed = JSON.parse(mat) as Record<string, { disabled: boolean }>
      const total = Object.keys(parsed).length
      const enabled = Object.values(parsed).filter((s) => s?.disabled === false).length
      console.log(`[cloud load] material in localStorage: ${total} entries, ${enabled} enabled`)
    } catch {
      console.log('[cloud load] material parse error')
    }
  } else {
    console.log('[cloud load] material not in localStorage after load')
  }

  window.dispatchEvent(new Event('localStorageUpdated'))
}

const Cloud = () => {
  const { t } = useTranslation('common')
  const { data: session } = useSession()
  const router = useRouter()
  // Debug: log which user is logged in
  if (session?.user) {
    console.log('[cloud] logged in as:', session.user.name, 'id:', (session.user as { id?: string }).id)
  }
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaved, setIsSaved] = useState(false as boolean | 'failed')
  const [isLoaded, setIsLoaded] = useState(false as boolean | 'failed')

  return (
    <VStack spacing={12} mt={12}>
      <Heading size="xl">{t('クラウドセーブ')}</Heading>

      <Text>{t('cloud-description')}</Text>

      {session == null ? (
        <AuthButton />
      ) : (
        <HStack spacing={8}>
          <Button
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
      )}
    </VStack>
  )
}

export default Cloud
