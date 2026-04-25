import fs from 'fs/promises'
import path from 'path'
import { fetchAndTransformData } from '../lib/master-data/update'

async function main() {
  console.log('Updating master data...')
  try {
    const data = await fetchAndTransformData()
    const filePath = path.resolve(process.cwd(), 'mocks', 'all.json')
    await fs.writeFile(filePath, JSON.stringify(data, null, 2))
    console.log(`Successfully updated master data at ${filePath}`)
  } catch (e) {
    console.error('Failed to update master data:', e)
    process.exit(1)
  }
}

main()
