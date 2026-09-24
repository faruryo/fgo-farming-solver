import { readFileSync } from 'node:fs'
import { productionIdsInPreviews } from './preview-binding-guard'

const toml = readFileSync('wrangler.toml', 'utf8')
const hits = productionIdsInPreviews(toml)

if (hits.length === 0) {
  console.log('previews bindings do not use production KV or D1 ids')
} else {
  console.error('previews block contains production KV or D1 ids:')
  for (const id of hits) console.error(`- ${id}`)
  process.exit(1)
}
