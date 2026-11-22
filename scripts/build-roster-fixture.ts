/**
 * スクリーンショット取り込みの実画面の fixture（lib/servant-roster-import/__fixtures__/real-screens.json）を作り直す。
 *
 *   pnpm dev --port <N>   # 別の端末で
 *   pnpm tsx scripts/build-roster-fixture.ts --base-url http://localhost:<N> \
 *     [--icons-url https://fgo-farming-solver.faru.jp/api/servant-face-icons] \
 *     skill-7col=/path/to/skill.png enhance-np-order=/path/to/enhance.png
 *
 * headless の Chromium で /material の取り込みを実際に動かし、analyze.ts の受け口（__rosterFixtureTap）から
 * カードごとの 16×16 の切り出しと帯の OCR の枠を受け取る。画像そのものと、所持数・ソートなど見出しの読みは書き出さない。
 * 各カードで近い順に TOP_SERVANTS 騎のサーヴァント（明るさをそろえた比べ直しでも同じ）について、一番近い差になった
 * アイコンと切り出しの組だけを残す。その騎の差は全部で比べたときと同じで、ほかの騎の差は大きくなるだけなので、
 * 今の決め方（一番近い差と次に近い差）の結果は変わらない。書き出す前に、絞った fixture で照合し直して確かめる。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { chromium, expect } from '@playwright/test'
import { rawPixelDiff } from '../lib/shop-screenshot-import/icon-match'
import type { RosterFixtureTap } from '../lib/servant-roster-import/analyze'
import { darkenedDiff, decodeFacePixels, faceCandidates, matchFaceCrops } from '../lib/servant-roster-import/face-match'
import type { FaceIconData } from '../lib/servant-roster-import/types'

const OUT = 'lib/servant-roster-import/__fixtures__/real-screens.json'
/** 各カードで残す近いサーヴァントの数（decideFace が見るのは上位 2 騎と、「要確認」に添える FACE_MATCH.reviewCandidates 騎） */
const TOP_SERVANTS = 5

type TappedCard = Omit<Parameters<RosterFixtureTap>[0], 'crops'> & {
  crops: { rect: { x: number; y: number; width: number; height: number }; crop: number[] }[]
}

const args = process.argv.slice(2)
const option = (name: string): string | undefined => {
  const i = args.indexOf(name)
  return i >= 0 ? args.splice(i, 2)[1] : undefined
}
const baseUrl = option('--base-url')
if (!baseUrl) throw new Error('--base-url を渡してください（pnpm dev で起動した dev server）')
const iconsUrl = option('--icons-url') ?? `${baseUrl}/api/servant-face-icons`
const images = args.map((arg) => {
  const [label, path] = arg.split('=')
  if (!label || !path) throw new Error(`画像は <名前>=<パス> で渡してください: ${arg}`)
  return { label, path }
})
if (images.length === 0) throw new Error('画像を1枚以上渡してください')

const tapCards = async (iconsBody: string): Promise<TappedCard[]> => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.addInitScript(() => {
      const w = window as unknown as { __rosterFixture: unknown[]; __rosterFixtureTap: RosterFixtureTap }
      w.__rosterFixture = []
      w.__rosterFixtureTap = (card) =>
        w.__rosterFixture.push({ ...card, crops: card.crops.map(({ rect, crop }) => ({ rect, crop: Array.from(crop) })) })
    })
    // dev server の照合用のデータは KV が無いと返らないので、取得したものを返す
    await page.route('**/api/servant-face-icons', (route) => route.fulfill({ contentType: 'application/json', body: iconsBody }))
    await page.goto(`${baseUrl}/material`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'スクリーンショットから取り込む' }).click()
    await page.getByTestId('roster-import-file-input').setInputFiles(images.map((i) => i.path))
    const analyze = page.getByRole('button', { name: '読み取る', exact: true })
    await expect(analyze).toBeEnabled()
    await analyze.click()
    await expect(page.getByText('照合用のデータ', { exact: false }).or(page.getByText('画像を読み取っています'))).toBeVisible()
    page.on('console', (m) => m.type() === 'error' && console.error(`[page] ${m.text()}`))
    const progress = setInterval(() => {
      void page
        .evaluate(() => `${(window as unknown as { __rosterFixture: unknown[] }).__rosterFixture.length} 枚 / ${document.querySelector('[role=dialog]')?.textContent?.slice(-60) ?? ''}`)
        .then((text) => console.log(`読み取り中: ${text}`))
        .catch(() => undefined)
    }, 30_000)
    try {
      await page.getByTestId('roster-import-summary').waitFor({ timeout: 1_800_000 })
    } finally {
      clearInterval(progress)
    }
    return await page.evaluate(() => (window as unknown as { __rosterFixture: TappedCard[] }).__rosterFixture)
  } finally {
    await browser.close()
  }
}

/** カードごとに、近い順に TOP_SERVANTS 騎の一番近いアイコンと切り出しの組だけを残す */
const pruneCards = (data: FaceIconData, cards: readonly TappedCard[]) => {
  const ids = new Set(data.icons.map((i) => i.servantId))
  const keptIcons = new Set<number>()
  const pruned = cards.map((card) => {
    const candidates = faceCandidates(data, ids, card.screen)
    // 候補の並びを data.icons の並びと対応させる（形の壊れたアイコンがあると対応がずれる）
    if (candidates.length !== data.icons.length) throw new Error('照合用のデータに読めないアイコンがあります')
    const crops = card.crops.map(({ rect, crop }) => ({ rect, crop: Uint8ClampedArray.from(crop) }))
    const modes = card.screen === 'skill' ? [rawPixelDiff, darkenedDiff] : [rawPixelDiff]
    const keptCrops = new Set<number>()
    for (const diffOf of modes) {
      const best = new Map<number, { diff: number; crop: number; icon: number }>()
      for (const [k, { crop }] of crops.entries()) {
        for (const [icon, c] of candidates.entries()) {
          const diff = diffOf(crop, c.pixels)
          const current = best.get(c.servantId)
          if (!current || diff < current.diff) best.set(c.servantId, { diff, crop: k, icon })
        }
      }
      const top = [...best].filter(([, b]) => Number.isFinite(b.diff)).sort((a, b) => a[1].diff - b[1].diff).slice(0, TOP_SERVANTS)
      for (const [, b] of top) {
        keptIcons.add(b.icon)
        keptCrops.add(b.crop)
      }
    }
    return { card, crops: crops.filter((_, k) => keptCrops.has(k)) }
  })

  return { pruned, icons: data.icons.filter((_, k) => keptIcons.has(k)).map((i) => ({ servantId: i.servantId, url: '', pixels: i.pixels })) }
}

const main = async () => {
  const res = await fetch(iconsUrl)
  if (!res.ok) throw new Error(`照合用のアイコンを取得できませんでした: ${iconsUrl} ${res.status}`)
  const iconsBody = await res.text()
  const data = JSON.parse(iconsBody) as FaceIconData
  const labelOf = new Map(images.map((i) => [basename(i.path), i.label]))
  const cards = (await tapCards(iconsBody)).filter((c) => !c.discarded)

  const { pruned, icons } = pruneCards(data, cards)
  const fixture = {
    icons,
    cards: pruned.map(({ card, crops }) => ({
      image: labelOf.get(card.image) ?? card.image,
      screen: card.screen,
      row: card.row,
      column: card.column,
      base: card.base,
      crops: crops.map(({ rect, crop }) => ({ rect, crop: Buffer.from(crop).toString('base64') })),
      top: card.top,
      bottom: card.bottom,
      expected: {
        servantId: card.face.kind === 'matched' ? card.face.servantId : null,
        lv: card.values.lv,
        npLv: card.values.npLv,
        skills: card.values.skills,
      },
    })),
  }

  // 絞った fixture で照合し直し、全部で比べたときと同じ結果になるかを確かめる
  const keptIds = new Set(icons.map((i) => i.servantId))
  for (const [k, c] of fixture.cards.entries()) {
    const crops = c.crops.map(({ rect, crop }) => ({ rect, crop: decodeFacePixels(crop) ?? new Uint8ClampedArray() }))
    const again = matchFaceCrops(crops, c.base, faceCandidates({ icons }, keptIds, c.screen), c.screen)
    const original = pruned.at(k)?.card.face
    if (JSON.stringify(again) !== JSON.stringify(original)) {
      throw new Error(`絞った fixture で結果が変わりました: ${c.image} ${c.row}-${c.column} ${JSON.stringify({ again, original })}`)
    }
  }

  writeFileSync(OUT, `${JSON.stringify(fixture)}\n`)
  const counts = Object.groupBy(fixture.cards, (c) => c.image)
  for (const [image, list] of Object.entries(counts)) {
    const review = list?.filter((c) => c.expected.servantId === null).length ?? 0
    console.log(`${image}: ${list?.length ?? 0} 枚（顔が要確認 ${review} 枚）`)
  }
  console.log(`アイコン ${icons.length} 個（${keptIds.size} 騎） / ${readFileSync(OUT).length} バイト → ${OUT}`)
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
