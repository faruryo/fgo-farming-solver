/**
 * Remove the __fetch cache from .open-next/cache/ before deploy.
 * This prevents the large Atlas Academy JSON (82MB) from being included
 * in Cloudflare Workers static assets (25MB limit).
 * The pre-rendered page cache (*.cache) is sufficient for serving /material.
 */
import { rm } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const fetchCacheDir = join(root, '.open-next', 'cache', '__fetch')

if (existsSync(fetchCacheDir)) {
  await rm(fetchCacheDir, { recursive: true })
  console.log('Removed .open-next/cache/__fetch (too large for static assets)')
} else {
  console.log('No __fetch cache to remove.')
}
