'use client'

import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  AlignJustify,
  X,
  Loader2,
  FlaskConical,
  Route,
  History,
  Users,
  Package,
  Cloud,
  BookOpen,
  Bell,
  FileText,
  type LucideIcon,
} from 'lucide-react'
import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useCloudSync } from '../../hooks/use-cloud-sync'

/* ------------------------------------------------------------------ */
/* Menu data                                                            */
/* ------------------------------------------------------------------ */

type MenuItem = {
  href: string
  icon: LucideIcon
  label: { ja: string; en: string }
}

type MenuGroup = {
  title: string
  items: MenuItem[]
}

export const menuGroups: MenuGroup[] = [
  {
    title: 'Tools',
    items: [
      { href: '/material',        icon: FlaskConical, label: { ja: '育成素材計算機', en: 'Material Calculator' } },
      { href: '/farming',         icon: Route,        label: { ja: '周回ソルバー',   en: 'Farming Solver' } },
      { href: '/farming/history', icon: History,      label: { ja: '計算履歴',       en: 'History' } },
    ],
  },
  {
    title: 'Reference',
    items: [
      { href: '/servants', icon: Users,   label: { ja: 'サーヴァント一覧', en: 'Servants' } },
      { href: '/items',    icon: Package, label: { ja: 'アイテム一覧',     en: 'Items' } },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/cloud', icon: Cloud, label: { ja: 'データ管理', en: 'Data Management' } },
    ],
  },
  {
    title: 'Docs',
    items: [
      { href: '/docs',    icon: BookOpen, label: { ja: '使い方',   en: 'About' } },
      { href: '/news',    icon: Bell,     label: { ja: 'お知らせ', en: 'News' } },
      { href: '/LICENSE', icon: FileText, label: { ja: 'License',  en: 'License' } },
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Design tokens                                                        */
/* ------------------------------------------------------------------ */

const NAV_BG      = 'rgba(14,22,38,0.98)'
const GOLD        = '#9a7224'
const GOLD2       = '#c09030'
const GOLD_DIM    = 'rgba(154,114,36,0.3)'
const GOLD_HOVER  = 'rgba(154,114,36,0.12)'
const GOLD_ACTIVE = 'rgba(154,114,36,0.2)'
const BORDER_LINE = 'rgba(154,114,36,0.28)'
const TEXT_BRIGHT = 'rgba(255,255,255,0.9)'
const TEXT_MID    = 'rgba(255,255,255,0.55)'
const TEXT_DIM    = 'rgba(255,255,255,0.35)'

/* ------------------------------------------------------------------ */
/* Header — brand + auth + close on one row                            */
/* ------------------------------------------------------------------ */

const NavHeader = () => {
  const { session } = useCloudSync()

  return (
    <div
      className="flex items-center gap-3 px-5 pt-8 pb-4 shrink-0"
      style={{ borderBottom: `1px solid ${BORDER_LINE}` }}
    >
      {/* Brand */}
      <div className="flex-1 min-w-0">
        <div
          className="text-sm font-bold tracking-[0.25em] leading-none"
          style={{ color: GOLD2, fontFamily: 'var(--serif)' }}
        >
          CHALDEA
        </div>
        <div className="text-[10px] mt-1 leading-none" style={{ color: TEXT_DIM }}>
          FGO周回ソルバー
        </div>
      </div>

      {/* Auth */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
          style={{
            background: session?.user ? GOLD_ACTIVE : 'rgba(255,255,255,0.06)',
            color: session?.user ? GOLD2 : TEXT_DIM,
            border: `1px solid ${session?.user ? GOLD_DIM : 'rgba(255,255,255,0.1)'}`,
          }}
        >
          {session?.user ? (session.user.name?.[0]?.toUpperCase() ?? '?') : '—'}
        </div>

        {session?.user ? (
          <span className="text-xs truncate max-w-[72px]" style={{ color: TEXT_MID }}>
            {session.user.name}
          </span>
        ) : (
          <SheetClose
            render={<NextLink href="/cloud" />}
            nativeButton={false}
            className="text-xs underline underline-offset-2"
            style={{ color: GOLD }}
          >
            ログイン
          </SheetClose>
        )}
      </div>

      {/* Close */}
      <SheetClose
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full shrink-0"
            style={{ color: TEXT_MID }}
            aria-label="閉じる"
          />
        }
      >
        <X size={16} />
      </SheetClose>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Cloud sync — lives inside the scroll area                           */
/* ------------------------------------------------------------------ */

const CloudRow = () => {
  const { t } = useTranslation('common')
  const {
    session, cloudData, isSaving, saveStatus,
    autoSyncEnabled, toggleAutoSync, hasConflict,
  } = useCloudSync()

  if (!session && process.env.NODE_ENV !== 'development') return null

  const isUpToDate = (saveStatus === true || !cloudData) && !hasConflict
  const iconColor  = hasConflict ? '#e05555' : isUpToDate ? GOLD_DIM : GOLD

  return (
    <div
      className="px-5 pt-4 pb-4"
      style={{ borderBottom: `1px solid ${BORDER_LINE}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2">
            <path d="M17.5 19c.7 0 1.3-.2 1.8-.7.5-.5.7-1.1.7-1.8 0-.5-.1-.9-.4-1.3-.2-.4-.6-.7-1-.9 0-.1 0-.2.1-.3 0-1.4-.5-2.6-1.5-3.5-1-.9-2.1-1.4-3.5-1.4-.9 0-1.8.2-2.6.7-.8.5-1.4 1.1-1.8 1.9-.3-.1-.6-.2-.9-.2-1.1 0-2.1.4-2.8 1.2s-1.1 1.7-1.1 2.8c0 1.1.4 2.1 1.2 2.8.8.8 1.7 1.2 2.8 1.2h10z" />
          </svg>
          <span
            className="text-[11px] font-bold tracking-[0.15em]"
            style={{ color: hasConflict ? '#e05555' : GOLD }}
          >
            {hasConflict ? 'CONFLICT' : 'CLOUD SYNC'}
          </span>
        </div>
        {isSaving && <Loader2 className="h-3 w-3 animate-spin" style={{ color: GOLD }} />}
      </div>

      {hasConflict ? (
        <SheetClose
          render={<NextLink href="/cloud" />}
          nativeButton={false}
          className="flex items-center justify-center w-full h-8 text-[11px] rounded border transition-colors"
          style={{ background: 'rgba(224,85,85,0.1)', borderColor: '#e05555', color: '#e05555' }}
        >
          解決 → データ管理
        </SheetClose>
      ) : (
        <div className="flex items-center gap-2">
          <label
            htmlFor="nav-auto-sync"
            className="text-xs flex-1 cursor-pointer"
            style={{ color: TEXT_MID }}
          >
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

/* ------------------------------------------------------------------ */
/* Nav item                                                             */
/* ------------------------------------------------------------------ */

const NavItem = ({
  href, icon: Icon, label, isActive,
}: {
  href: string
  icon: LucideIcon
  label: string
  isActive: boolean
}) => (
  <SheetClose
    render={<NextLink href={href} />}
    nativeButton={false}
    className="flex items-center gap-3 w-full px-5 py-3.5 transition-colors"
    style={{
      color: isActive ? GOLD2 : TEXT_BRIGHT,
      background: isActive ? GOLD_ACTIVE : 'transparent',
    }}
    onMouseEnter={e => {
      if (!isActive) (e.currentTarget as HTMLElement).style.background = GOLD_HOVER
    }}
    onMouseLeave={e => {
      if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
    }}
  >
    <Icon size={16} style={{ color: isActive ? GOLD2 : GOLD, flexShrink: 0 }} />
    <span className="text-sm leading-none">{label}</span>
    {isActive && (
      <div className="ml-auto w-1 h-3 rounded-full" style={{ background: GOLD2 }} />
    )}
  </SheetClose>
)

/* ------------------------------------------------------------------ */
/* Main Nav                                                             */
/* ------------------------------------------------------------------ */

export const Nav = () => {
  const { i18n } = useTranslation()
  const locale   = i18n.language as 'en' | 'ja'
  const pathname = usePathname()

  return (
    <nav>
      <Sheet>
        <SheetTrigger
          render={
            <Button
              aria-label="Menu"
              variant="ghost"
              size="icon"
              style={{ color: GOLD }}
              className="hover:bg-[rgba(154,114,36,0.15)]"
            />
          }
        >
          <AlignJustify size={20} />
        </SheetTrigger>

        <SheetContent
          side="right"
          showCloseButton={false}
          className="gap-0 p-0 sm:max-w-[280px] border-l flex flex-col"
          style={{ background: NAV_BG, borderColor: GOLD_DIM }}
        >
          {/* Fixed header: brand + auth + close */}
          <NavHeader />

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            {/* Cloud sync at top of scroll */}
            <CloudRow />

            {/* Nav groups */}
            {menuGroups.map(({ title, items }, gi) => (
              <React.Fragment key={title}>
                {gi > 0 && (
                  <div className="mx-5 my-1" style={{ borderTop: `1px solid ${BORDER_LINE}` }} />
                )}
                <div>
                  <div
                    className="px-5 pt-5 pb-2 text-[11px] tracking-[0.15em] font-bold uppercase"
                    style={{ color: GOLD }}
                  >
                    {title}
                  </div>
                  {items.map(({ href, icon, label }) => (
                    <NavItem
                      key={href}
                      href={href}
                      icon={icon}
                      label={label[locale ?? 'ja']}
                      isActive={pathname === href || (href !== '/' && pathname.startsWith(href))}
                    />
                  ))}
                </div>
              </React.Fragment>
            ))}

            {/* Footer */}
            <div
              className="px-5 py-4 mt-2 text-center"
              style={{ borderTop: `1px solid ${BORDER_LINE}` }}
            >
              <span className="text-[11px] tracking-widest" style={{ color: TEXT_DIM }}>
                © CHALDEA PROJECT
              </span>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  )
}
