import { test, expect } from '@playwright/test'

const pages = [
  { name: 'dashboard', path: '/' },
  { name: 'farming', path: '/farming' },
  { name: 'material', path: '/material' },
  { name: 'items', path: '/items' },
  { name: 'servants', path: '/servants' },
  { name: 'cloud', path: '/cloud' },
]

for (const { name, path } of pages) {
  test(`visual regression - ${name}`, async ({ page }) => {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      threshold: 0.1,
    })
  })
}
