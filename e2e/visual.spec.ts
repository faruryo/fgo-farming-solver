import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect } from '@playwright/test'

// The dev /api/progress mock rotates its scenarios every 3 seconds and Mash's line is
// picked with Math.random, so the dashboard differed between runs of the same commit (#149).
const [progressScenario] = JSON.parse(readFileSync(resolve(__dirname, '../mocks/progress.json'), 'utf8')) as Record<string, unknown>[]
const { _scenario, ...progressMock } = progressScenario

// Task-list deadlines, campaign/gacha countdowns and the recommended quests depend on the clock.
// 2026-06-10 12:00 JST is inside every campaign and summon in the local master data.
const FIXED_NOW = new Date('2026-06-10T12:00:00+09:00')

// Server renders still use the real clock, so pages like farming hit a hydration mismatch and re-render on the client with this time.
test.use({ timezoneId: 'Asia/Tokyo' })

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
  await page.addInitScript(() => {
    Math.random = () => 0.5
  })
  await page.route('**/api/progress', (route) => route.fulfill({ json: progressMock }))
})

const pages = [
  { name: 'dashboard', path: '/' },
  { name: 'farming', path: '/farming' },
  { name: 'material', path: '/material', waitFor: '.c-servant-grid, .c-card' },
  { name: 'items', path: '/items' },
  { name: 'servants', path: '/servants' },
  { name: 'cloud', path: '/cloud' },
]

for (const { name, path, waitFor } of pages) {
  test(`visual regression - ${name}`, async ({ page }) => {
    if (name === 'material') test.setTimeout(60000)
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: 15000 }).catch(() => {})
    }
    // Lazy images below the fold otherwise start loading while the full-page shot is taken.
    await page.evaluate(() => document.querySelectorAll('img').forEach((img) => { img.loading = 'eager' }))
    await page.waitForFunction(() => [...document.images].every((img) => img.complete))
    // framer-motion staggers the dashboard sections in with inline opacity, and toHaveScreenshot
    // treats the still frames before a late section starts as stable, so wait until they finish.
    await page
      .waitForFunction(() => [...document.querySelectorAll<HTMLElement>('[style*="opacity"]')].every((el) => el.style.opacity === '1'), null, { timeout: 5000 })
      .catch(() => {})
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      threshold: 0.1,
      stylePath: resolve(__dirname, 'screenshot.css'),
    })
  })
}
