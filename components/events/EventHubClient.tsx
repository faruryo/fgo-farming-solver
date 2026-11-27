'use client'

import React, { useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../common/page-header'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { EventFeature } from '../../data/event-features'
import { isServantOnlyShop, type EventSummary } from '../../lib/event-features'
import type { EventPlannerEvent } from '../../lib/master-data/types'
import type { EnrichedItem } from '../../lib/get-items'
import { EventPlannerClient } from './EventPlannerClient'
import { EventCraftSection } from './EventCraftSection'
import { EventShopCatalog, EventShopList } from './EventShopList'
import { formatDate } from './EventListClient'

interface Props {
  summary: EventSummary
  boxEvent?: EventPlannerEvent
  items?: EnrichedItem[]
  features: EventFeature[]
  /** 交換所の品目の atlasId → 素材1個の AP 換算値。 */
  shopApPrices?: Readonly<Record<number, number>>
  /** イベントポイントの品目の atlasId（交換所の周回計算があり、ポイントの品目があるときだけ）。 */
  pointItemId?: number
  /** URL のクエリ `tab` で指定されたタブ。無い・そのイベントに無いタブなら並びの最初のタブを開く。 */
  initialTab?: string
}

const noopSubscribe = () => () => {}
// getSnapshot は連続呼び出しで同じ値を返す必要があるため分単位に丸める。SSR/hydration 中は 0（未判定）。
const getNowSec = () => Math.floor(Date.now() / 60_000) * 60

const StatusBadge: React.FC<{ summary: EventSummary }> = ({ summary }) => {
  const { t } = useTranslation('events')
  const nowSec = useSyncExternalStore(noopSubscribe, getNowSec, () => 0)
  const isActive = nowSec > 0 && summary.startedAt <= nowSec && summary.endedAt >= nowSec
  const isEnded = nowSec > 0 && summary.endedAt < nowSec
  if (isActive) return <Badge variant="destructive" className="text-[10px]">{t('開催中')}</Badge>
  if (isEnded) return <Badge variant="outline" className="text-[10px]">{t('終了')}</Badge>
  return <Badge variant="secondary" className="text-[10px]">{t('開催予定')}</Badge>
}

const Header: React.FC<{ summary: EventSummary; box?: EventPlannerEvent }> = ({ summary, box }) => {
  const { t } = useTranslation('events')
  return (
    <PageHeader
      backLabel={t('イベント一覧へ戻る')}
      backHref="/events"
      en={t('event-planner-eyebrow', 'EVENT PLANNER')}
      title={summary.name}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge summary={summary} />
        <span className="text-xs" style={{ color: 'var(--text3)' }}>
          {formatDate(summary.startedAt)} 〜 {formatDate(summary.endedAt)}
        </span>
        {box && (
          <>
            <span className="text-xs" style={{ color: 'var(--text3)' }}>
              {t('箱数', { count: box.lotteries.length })}
            </span>
            <span className="text-xs" style={{ color: 'var(--text3)' }}>
              {box.currency.name}
            </span>
          </>
        )}
      </div>
    </PageHeader>
  )
}

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
    {children}
  </h2>
)

const SectionDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs" style={{ color: 'var(--text2)' }}>
    {children}
  </p>
)

type TFunction = ReturnType<typeof useTranslation>['t']

/** 1つの機能の欄。タブの列を出すときは見出しを出さず、説明の1行と中身だけを出す。 */
interface TabSection {
  /** タブの名前（URL のクエリ `tab` の値と同じ）。 */
  id: EventFeature
  tabLabel: string
  /** タブが1つだけのときに出す見出し。 */
  title: string
  description?: string
  content: React.ReactNode
}

interface TabContext {
  t: TFunction
  props: Props
}

/**
 * タブの並びの表。この順にタブを並べ、`build` が undefined を返す機能のタブは出さない。
 * 機能を足すときは、この表に1行足す。
 */
const TAB_TABLE: { id: EventFeature; build: (ctx: TabContext) => Omit<TabSection, 'id'> | undefined }[] = [
  {
    id: 'box',
    build: ({ t, props: { features, boxEvent, items } }) => {
      if (!features.includes('box') || !boxEvent) return undefined
      return {
        tabLabel: t('event-tab-box', 'ボックス'),
        title: t('ロト計画'),
        content: <EventPlannerClient event={boxEvent} items={items} />,
      }
    },
  },
  {
    id: 'shop',
    build: ({ t, props: { features, boxEvent, items, shopApPrices, pointItemId } }) => {
      if (!features.includes('shop') || !boxEvent || boxEvent.shop.length === 0) return undefined
      const tabLabel = t('event-tab-shop', '交換所')
      if (isServantOnlyShop(boxEvent.shop)) {
        return {
          tabLabel,
          title: t('event-shop-catalog-title', '交換所の品目'),
          description: t(
            'event-shop-catalog-description',
            'この交換所には礼装などしか並ばないため、周回数は計算せず、品目と対価だけを並べます',
          ),
          content: <EventShopCatalog shop={boxEvent.shop} />,
        }
      }
      return {
        tabLabel,
        title: t('event-shop-section-title', '交換所の周回計算'),
        description: t('event-shop-section-description', '交換したい数を入れると、要る周回数と AP が出ます'),
        content: (
          <EventShopList
            key={boxEvent.id}
            event={boxEvent}
            apPrices={shopApPrices}
            pointItemId={pointItemId}
            items={items}
          />
        ),
      }
    },
  },
  {
    id: 'craft',
    build: ({ t, props: { features, items } }) => {
      if (!features.includes('craft') || !items) return undefined
      return {
        tabLabel: t('event-tab-craft', 'クラフト'),
        title: t('event-craft-section-title', 'クラフト'),
        content: <EventCraftSection items={items} />,
      }
    },
  },
]

/** 指定されたタブがあればそれ、無ければ並びの最初のタブ。 */
export const resolveEventTab = (sections: readonly Pick<TabSection, 'id'>[], requested: string | undefined) =>
  sections.find(section => section.id === requested)?.id ?? sections[0]?.id

/** 開いたタブを、履歴を増やさずに URL のクエリ `tab` へ書く。 */
const writeTabQuery = (tab: string) => {
  const url = new URL(window.location.href)
  url.searchParams.set('tab', tab)
  window.history.replaceState(null, '', url)
}

const SectionBody: React.FC<{ section: TabSection; withTitle: boolean }> = ({ section, withTitle }) => (
  <section className="flex flex-col gap-4">
    {(withTitle || section.description) && (
      <div className="flex flex-col gap-1">
        {withTitle && <SectionTitle>{section.title}</SectionTitle>}
        {section.description && <SectionDescription>{section.description}</SectionDescription>}
      </div>
    )}
    {section.content}
  </section>
)

/**
 * 機能ごとのタブ。タブの中身は初めて開いたときに描き、その後は切り替えても描いたまま隠す
 * （ボックス計画の入力は保存しないので、外すと消える）。
 */
const EventTabs: React.FC<{ sections: TabSection[]; initialTab?: string }> = ({ sections, initialTab }) => {
  const [active, setActive] = useState(() => resolveEventTab(sections, initialTab))
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set(active ? [active] : []))
  const current = resolveEventTab(sections, active)
  const select = (value: unknown) => {
    const next = sections.find(section => section.id === value)?.id
    if (!next || next === current) return
    setActive(next)
    setOpened(prev => new Set(prev).add(next))
    writeTabQuery(next)
  }
  return (
    <Tabs value={current} onValueChange={select} className="gap-4">
      <TabsList>
        {sections.map(section => (
          <TabsTrigger key={section.id} value={section.id} className="px-3">
            {section.tabLabel}
          </TabsTrigger>
        ))}
      </TabsList>
      {sections.map(section => (
        <TabsContent key={section.id} value={section.id} keepMounted>
          {(opened.has(section.id) || section.id === current) && <SectionBody section={section} withTitle={false} />}
        </TabsContent>
      ))}
    </Tabs>
  )
}

export const EventHubClient: React.FC<Props> = props => {
  const { summary, boxEvent, features, initialTab } = props
  const { t } = useTranslation('events')
  const box = features.includes('box') ? boxEvent : undefined
  const sections = TAB_TABLE.flatMap(({ id, build }) => {
    const section = build({ t, props })
    return section ? [{ id, ...section }] : []
  })
  const [single] = sections

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="flex flex-col gap-6">
          <Header summary={summary} box={box} />
          {sections.length > 1 ? (
            <EventTabs sections={sections} initialTab={initialTab} />
          ) : (
            single && <SectionBody section={single} withTitle />
          )}
        </div>
      </div>
    </div>
  )
}
