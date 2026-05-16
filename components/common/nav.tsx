'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Loader2, AlignJustify } from 'lucide-react'
import NextLink from 'next/link'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useCloudSync } from '../../hooks/use-cloud-sync'
import { LangMenuItem } from './lang-menu-item'

export const menuGroups = [
  {
    title: 'Tools',
    items: [
      { href: '/material',         label: { ja: '育成素材計算機', en: 'Material Calculator' } },
      { href: '/farming',          label: { ja: '周回ソルバー',   en: 'Farming Solver' } },
      { href: '/farming/history',  label: { ja: '計算履歴',       en: 'History' } },
    ],
  },
  {
    title: 'Reference',
    items: [
      { href: '/servants', label: { ja: 'サーヴァント一覧', en: 'Servants' } },
      { href: '/items',    label: { ja: 'アイテム一覧',     en: 'Items' } },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/cloud', label: { ja: 'データ管理', en: 'Data Management' } },
    ],
  },
  {
    title: 'Docs',
    items: [
      { href: '/docs',    label: { ja: '使い方',    en: 'About' } },
      { href: '/news',    label: { ja: 'お知らせ',  en: 'News' } },
      { href: '/LICENSE', label: { ja: 'License',   en: 'License' } },
    ],
  },
]

const AuthStatus = () => {
  const { session } = useCloudSync()
  return (
    <div className="px-3 py-2 flex items-center gap-2">
      <div
        className="w-[7px] h-[7px] rounded-full flex-shrink-0"
        style={{ background: session?.user ? 'var(--ok)' : 'var(--text3)' }}
      />
      {session?.user ? (
        <span className="text-[11px] truncate flex-1" style={{ color: 'var(--text2)' }}>
          {session.user.name}
        </span>
      ) : (
        <>
          <span className="text-[11px]" style={{ color: 'var(--text3)' }}>未ログイン</span>
          <NextLink href="/cloud">
            <span className="text-[10px] underline" style={{ color: 'var(--steel)' }}>ログイン</span>
          </NextLink>
        </>
      )}
    </div>
  )
}

const CloudSyncContent = () => {
  const { t } = useTranslation('common')
  const { session, cloudData, isSaving, saveStatus, autoSyncEnabled, toggleAutoSync, hasConflict } = useCloudSync()

  if (!session && process.env.NODE_ENV !== 'development') return null

  const isUpToDate = (saveStatus === true || !cloudData) && !hasConflict

  return (
    <div className="px-3 py-2 mb-1">
      <div className="flex justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hasConflict ? 'var(--red)' : isUpToDate ? 'var(--gold-dim)' : 'var(--gold)'} strokeWidth="2">
              <path d="M17.5 19c.7 0 1.3-.2 1.8-.7.5-.5.7-1.1.7-1.8 0-.5-.1-.9-.4-1.3-.2-.4-.6-.7-1-.9 0-.1 0-.2.1-.3 0-1.4-.5-2.6-1.5-3.5-1-.9-2.1-1.4-3.5-1.4-.9 0-1.8.2-2.6.7-.8.5-1.4 1.1-1.8 1.9-.3-.1-.6-.2-.9-.2-1.1 0-2.1.4-2.8 1.2s-1.1 1.7-1.1 2.8c0 1.1.4 2.1 1.2 2.8.8.8 1.7 1.2 2.8 1.2h10z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold tracking-wide" style={{ color: hasConflict ? 'var(--red)' : 'var(--gold)' }}>
            {hasConflict ? 'SYNC CONFLICT' : 'CLOUD SYNC'}
          </span>
        </div>
        {isSaving && <Loader2 className="h-3 w-3 animate-spin" style={{ color: 'var(--gold)' }} />}
      </div>

      {hasConflict ? (
        <NextLink href="/cloud">
          <Button variant="ghost" size="sm" className="w-full text-[10px] h-8" style={{ background: 'rgba(255,0,0,0.1)', color: 'var(--red)' }}>
            解決のためにデータ管理へ
          </Button>
        </NextLink>
      ) : (
        <div className="flex items-center">
          <label htmlFor="nav-auto-sync" className="text-[11px] flex-1 cursor-pointer" style={{ color: 'var(--text2)' }}>
            {t('auto-sync-label', '同期の自動化')}
          </label>
          <Switch
            id="nav-auto-sync"
            checked={autoSyncEnabled}
            onCheckedChange={() => toggleAutoSync()}
            size="sm"
            className="gold-switch"
          />
        </div>
      )}
    </div>
  )
}

export const Nav = () => {
  const { i18n } = useTranslation()
  const locale = i18n.language

  return (
    <nav>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Menu"
              variant="ghost"
              size="icon"
              style={{ color: 'var(--gold)' }}
              className="hover:text-[var(--gold2)] hover:bg-[rgba(154,114,36,0.1)]"
            />
          }
        >
          <AlignJustify size={20} />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[240px] py-1"
          style={{ background: 'var(--panel)', borderColor: 'var(--gold-dim)', backdropFilter: 'blur(20px)' }}
        >
          <AuthStatus />
          <DropdownMenuSeparator style={{ borderColor: 'rgba(154,114,36,0.1)' }} />
          <CloudSyncContent />
          <DropdownMenuSeparator style={{ borderColor: 'rgba(154,114,36,0.1)' }} />

          {menuGroups.map(({ title, items }) => (
            <DropdownMenuGroup key={title}>
              <DropdownMenuLabel
                className="px-3 py-1 text-[10px] tracking-widest font-semibold"
                style={{ color: 'var(--gold)' }}
              >
                {title}
              </DropdownMenuLabel>
              {items.map(({ href, label }) => (
                <DropdownMenuItem
                  key={href}
                  render={<NextLink href={href} />}
                  className="px-3 py-2 rounded-none"
                  style={{ color: 'var(--text)', fontSize: '13px', lineHeight: '1.4' }}
                >
                  {label[(locale ?? 'ja') as 'en' | 'ja']}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ))}
          <DropdownMenuSeparator style={{ borderColor: 'rgba(154,114,36,0.1)' }} />
          <LangMenuItem />
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  )
}
