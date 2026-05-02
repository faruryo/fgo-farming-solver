import fs from 'fs/promises'
import path from 'path'

async function main() {
  console.log('Updating master data...')
  try {
    const { fetchAndTransformData, fetchDashboardMeta } = await import('../lib/master-data/update')
    
    // Update main master data
    const data = await fetchAndTransformData()
    const allPath = path.resolve(process.cwd(), 'mocks', 'all.json')
    await fs.writeFile(allPath, JSON.stringify(data, null, 2))
    console.log(`Successfully updated master data at ${allPath}`)

    // Update dashboard meta
    const dashboardData = await fetchDashboardMeta()
    const dashboardPath = path.resolve(process.cwd(), 'mocks', 'dashboard.json')
    await fs.writeFile(dashboardPath, JSON.stringify(dashboardData, null, 2))
    console.log(`Successfully updated dashboard metadata at ${dashboardPath}`)
    
  } catch (e) {
    console.error('Failed to update master data:', e)
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
