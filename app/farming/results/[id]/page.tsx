import { getResult } from '../../../../lib/get-result'
import { getLocalQuests } from '../../../../lib/get-local-quests'
import { getLocalItems } from '../../../../lib/get-local-items'
import { Page, type PageProps } from '../../../../components/farming/result'
import { notFound } from 'next/navigation'
import { DBError } from '../../../../lib/dynamodb'
import { isBothResult, type Result, type BothResult } from '../../../../interfaces/api'
import { auth } from '../../../../lib/auth'

type ResultContext = {
  id: string
  isOwner: boolean
  isPublic: boolean
  locale: string
}

async function buildBothPageProps(
  raw: BothResult & {
    createdAt?: string
    siblingResult?: BothResult | null
  },
  ctx: ResultContext
): Promise<PageProps> {
  const [apItems, apQuests, lapItems, lapQuests] = await Promise.all([
    getLocalItems(raw.ap.items, ctx.locale),
    getLocalQuests(raw.ap.quests, ctx.locale),
    getLocalItems(raw.lap.items, ctx.locale),
    getLocalQuests(raw.lap.quests, ctx.locale),
  ])

  let stockApResult = undefined
  let stockLapResult = undefined
  if (raw.siblingResult && isBothResult(raw.siblingResult)) {
    const [sApItems, sApQuests, sLapItems, sLapQuests] = await Promise.all([
      getLocalItems(raw.siblingResult.ap.items, ctx.locale),
      getLocalQuests(raw.siblingResult.ap.quests, ctx.locale),
      getLocalItems(raw.siblingResult.lap.items, ctx.locale),
      getLocalQuests(raw.siblingResult.lap.quests, ctx.locale),
    ])
    stockApResult = { ...raw.siblingResult.ap, items: sApItems as any, quests: sApQuests as any }
    stockLapResult = { ...raw.siblingResult.lap, items: sLapItems as any, quests: sLapQuests as any }
  }

  return {
    apResult: { ...raw.ap, items: apItems, quests: apQuests },
    lapResult: { ...raw.lap, items: lapItems, quests: lapQuests },
    createdAt: raw.createdAt,
    stockApResult,
    stockLapResult,
    isOwner: ctx.isOwner,
    isPublic: ctx.isPublic,
    resultId: ctx.id,
  }
}

async function buildLegacyPageProps(
  raw: Result & { createdAt?: string },
  ctx: ResultContext
): Promise<PageProps> {
  const { items, quests, ...result } = raw
  const [localItems, localQuests] = await Promise.all([
    getLocalItems(items, ctx.locale),
    getLocalQuests(quests, ctx.locale),
  ])
  return {
    legacyResult: { ...result, items: localItems, quests: localQuests },
    createdAt: raw.createdAt,
    isOwner: ctx.isOwner,
    isPublic: ctx.isPublic,
    resultId: ctx.id,
  }
}

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [{ id }, session] = await Promise.all([params, auth()])
  const locale = 'ja'

  try {
    const raw = await getResult(id, session?.user?.id)
    const ctx: ResultContext = {
      id,
      isOwner: raw.isOwner ?? false,
      isPublic: raw.isPublic !== false,
      locale,
    }

    const pageProps = isBothResult(raw)
      ? await buildBothPageProps(raw, ctx)
      : await buildLegacyPageProps(raw, ctx)

    return <Page {...pageProps} />
  } catch (e) {
    if (!(e instanceof DBError)) console.error(e)
    return notFound()
  }
}
