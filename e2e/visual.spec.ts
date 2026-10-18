import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect } from '@playwright/test'

// The dev /api/progress mock rotates its scenarios every 3 seconds and Mash's line is
// picked with Math.random, so the dashboard differed between runs of the same commit (#149).
const [progressScenario] = JSON.parse(readFileSync(resolve(__dirname, '../mocks/progress.json'), 'utf8')) as Record<string, unknown>[]
const { _scenario, ...progressMock } = progressScenario

test.beforeEach(async ({ page }) => {
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
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      threshold: 0.1,
    })
  })
}
