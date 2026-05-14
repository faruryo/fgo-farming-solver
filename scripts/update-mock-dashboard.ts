import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fetchDashboardMeta } from '../lib/master-data/update'

const outPath = resolve(process.cwd(), 'mocks/dashboard.json')

async function main() {
  console.log('Fetching dashboard meta from Atlas Academy...')
  const data = await fetchDashboardMeta()
  await writeFile(outPath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`Done — ${data.events.length} events, ${data.gachas.length} gachas, ${data.recentServants.length} recent servants`)
  console.log(`Written to ${outPath}`)
}

main().catch(e => {
  console.error('Failed:', e)
  process.exit(1)
})
