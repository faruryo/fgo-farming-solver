'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import NextLink from 'next/link'
import { useTranslation } from 'react-i18next'
import { useCloudSync } from '../../hooks/use-cloud-sync'
import React from 'react'

export const CloudIndicator = () => {
  const { t } = useTranslation('common')
  const { session, cloudData, isSaving, saveStatus, autoSyncEnabled, toggleAutoSync, handleSave, hasConflict } = useCloudSync()

  if (!session && process.env.NODE_ENV !== 'development') return null

  const isUpToDate = (saveStatus === true || !cloudData) && !hasConflict
  const iconColor = isSaving ? 'var(--gold)' : hasConflict ? 'var(--red)' : isUpToDate ? 'var(--gold-dim)' : 'var(--gold)'

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger render={<span />}>
          <PopoverTrigger render={<span />}>
            <Button
              aria-label="Cloud Sync"
              variant="ghost"
              size="icon"
              style={{ color: iconColor }}
              className="hover:bg-[rgba(154,114,36,0.1)]"
            >
              <div className="relative">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.5 19c.7 0 1.3-.2 1.8-.7.5-.5.7-1.1.7-1.8 0-.5-.1-.9-.4-1.3-.2-.4-.6-.7-1-.9 0-.1 0-.2.1-.3 0-1.4-.5-2.6-1.5-3.5-1-.9-2.1-1.4-3.5-1.4-.9 0-1.8.2-2.6.7-.8.5-1.4 1.1-1.8 1.9-.3-.1-.6-.2-.9-.2-1.1 0-2.1.4-2.8 1.2s-1.1 1.7-1.1 2.8c0 1.1.4 2.1 1.2 2.8.8.8 1.7 1.2 2.8 1.2h10z" />
                </svg>
                {isSaving && (
                  <Loader2 className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 animate-spin" style={{ color: 'var(--gold)' }} />
                )}
                {hasConflict && !isSaving && (
                  <div className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full border-2" style={{ background: 'var(--red)', borderColor: 'var(--bg)' }} />
                )}
                {!isSaving && !isUpToDate && !hasConflict && (
                  <div className="absolute top-0 right-0 w-2 h-2 rounded-full border-2" style={{ background: 'var(--gold)', borderColor: 'var(--bg)' }} />
                )}
              </div>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {isSaving ? 'Saving...' : hasConflict ? 'Conflicts detected (Cloud is newer)' : 'Cloud Sync'}
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        side="bottom"
        align="end"
        className="w-[240px] p-4 rounded-2xl"
        style={{ background: 'var(--panel)', borderColor: hasConflict ? 'var(--red)' : 'var(--gold-dim)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)' }}
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs font-bold tracking-wide" style={{ color: hasConflict ? 'var(--red)' : 'var(--gold)' }}>
            {hasConflict ? 'CONFLICT DETECTED' : 'CLOUD SYNC'}
          </p>

          {hasConflict && (
            <p className="text-[10px] leading-tight" style={{ color: 'var(--text2)' }}>
              Cloud data is newer than local. Please load the latest data to avoid overwriting.
            </p>
          )}

          <div className="flex items-center">
            <label htmlFor="header-auto-sync" className="text-xs flex-1 cursor-pointer" style={{ color: 'var(--text)' }}>
              {t('auto-sync-label', '同期の自動化')}
            </label>
            <Switch
              id="header-auto-sync"
              checked={autoSyncEnabled}
              disabled={hasConflict}
              onCheckedChange={() => toggleAutoSync()}
              size="sm"
              className="gold-switch"
            />
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 text-[11px] h-8"
              variant="outline"
              style={{ borderColor: hasConflict ? 'var(--red)' : 'var(--gold-dim)', color: hasConflict ? 'var(--red)' : 'var(--gold)' }}
              onClick={() => handleSave()}
              disabled={isSaving || hasConflict}
            >
              {isSaving && <Loader2 className="animate-spin h-3 w-3 mr-1" />}
              {t('保存')}
            </Button>
            <Button
              className="flex-1 text-[11px] h-8"
              style={{ background: hasConflict ? 'var(--red)' : 'var(--gold)', color: 'var(--bg)' }}
              render={<NextLink href="/cloud" />}
            >
              {t('詳細')}
            </Button>
          </div>

          {saveStatus === 'failed' && (
            <p className="text-[10px] text-center" style={{ color: 'var(--red)' }}>Sync failed. Check details.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
