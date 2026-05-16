import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'

interface BackupData {
  metadata: {
    app: string
    version: string
    exportedAt: string
  }
  storage: Record<string, string>
}

interface LocalSectionProps {
  exportLocal: () => void
}

export const LocalSection = ({ exportLocal }: LocalSectionProps) => {
  const { t } = useTranslation('common')
  const router = useRouter()

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm(t('import-confirm'))) {
      e.target.value = ''
      return
    }

    try {
      const text = await file.text()
      const backup = JSON.parse(text) as BackupData
      if (backup.metadata?.app !== 'fgo-farming-solver') {
        alert(t('import-error'))
        return
      }

      const storage = backup.storage || {}
      Object.entries(storage).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
          localStorage.setItem(key, value)
        }
      })
      window.dispatchEvent(new Event('localStorageUpdated'))
      alert(t('import-success'))
      router.refresh()
    } catch {
      alert(t('import-error'))
    }
    e.target.value = ''
  }

  return (
    <div className="c-card max-w-[600px] w-full p-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(74,104,136,0.1)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--steel)" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          </div>
          <p className="font-bold" style={{ color: 'var(--steel)' }}>{t('local-backup-title')}</p>
        </div>

        <p className="text-sm" style={{ color: 'var(--text2)' }}>{t('local-backup-description')}</p>

        <div className="flex gap-4 w-full">
          <Button
            className="flex-1 h-11 text-sm"
            variant="outline"
            style={{ borderColor: 'rgba(74,104,136,0.4)', color: 'var(--text)' }}
            onClick={exportLocal}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t('export-to-file')}
          </Button>

          <div style={{ flex: 1, position: 'relative' }}>
            <Button
              className="w-full h-11 text-sm"
              variant="outline"
              style={{ borderColor: 'rgba(74,104,136,0.4)', color: 'var(--text)' }}
              render={<label htmlFor="import-file" />}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {t('import-from-file')}
            </Button>
            <input
              id="import-file"
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: '0' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
