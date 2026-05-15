import { test, expect } from '@playwright/test'

const pages = [
  { name: 'dashboard', path: '/' },
  { name: 'farming', path: '/farming' },
  { name: 'material', path: '/material', waitFor: '.c-servant-grid, .c-card', testTimeout: 60000 },
  { name: 'items', path: '/items' },
  { name: 'servants', path: '/servants' },
  { name: 'cloud', path: '/cloud' },
]

for (const { name, path, waitFor, testTimeout } of pages) {
  test(`visual regression - ${name}`, { timeout: testTimeout }, async ({ page }) => {
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
