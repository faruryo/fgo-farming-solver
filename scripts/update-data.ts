import fs from 'fs/promises'
import path from 'path'

async function main() {
  console.log('Updating master data...')
  try {
    const { fetchAndTransformData, fetchDashboardMeta } = await import('../lib/master-data/update')

    // 既存 mocks/all.json を previous として渡し、コミット済みモックの短縮IDを
    // ピン留めする（再生成でIDがずれて保存済みクエスト選択が壊れるのを防ぐ）。
    const allPath = path.resolve(process.cwd(), 'mocks', 'all.json')
    let previous
    try {
      previous = JSON.parse(await fs.readFile(allPath, 'utf-8'))
    } catch {
      console.log('No existing mocks/all.json; assigning IDs from scratch.')
    }

    // Update main master data
    const data = await fetchAndTransformData({ previous })
    // KV 書込みと同じ整合性ゲート（ID一意性・Daily形状・参照整合）。
    // 不正な採番結果をモックとしてコミットしてしまうのを防ぐ。
    const { validateMasterData } = await import('../lib/master-data/validation')
    const v = validateMasterData(data)
    if (!v.ok) {
      throw new Error(`Refusing to write degraded mocks/all.json: ${v.reason}`)
    }
    await fs.writeFile(allPath, JSON.stringify(data, null, 2))
    console.log(`Successfully updated master data at ${allPath}`)

    // Update dashboard meta (pass master quests so podFreePeriods can resolve aaQuestId → short ID)
    const dashboardData = await fetchDashboardMeta(data.quests)
    const dashboardPath = path.resolve(process.cwd(), 'mocks', 'dashboard.json')
    await fs.writeFile(dashboardPath, JSON.stringify(dashboardData, null, 2))
    console.log(`Successfully updated dashboard metadata at ${dashboardPath}`)

    // Precompute rarity AP tables
    console.log('Precomputing rarity AP tables...')
    const { buildRarityApTables } = await import('../lib/progress/rarity-ap-table')
    const rarityApTables = await buildRarityApTables()
    const rarityApPath = path.resolve(process.cwd(), 'mocks', 'rarity-ap-tables.json')
    await fs.writeFile(rarityApPath, JSON.stringify(rarityApTables, null, 2))
    console.log(`Successfully precomputed and saved rarity AP tables at ${rarityApPath}`)

    // Save lightweight servant list
    console.log('Generating lightweight servant list...')
    const { getNiceServants } = await import('../lib/get-nice-servants')
    const servants = await getNiceServants()
    const servantList = servants.map((s) => ({ id: s.id, name: s.name, rarity: s.rarity }))
    const servantsPath = path.resolve(process.cwd(), 'mocks', 'servants.json')
    await fs.writeFile(servantsPath, JSON.stringify(servantList, null, 2))
    console.log(`Successfully saved lightweight servant list at ${servantsPath}`)
    
  } catch (e) {
    console.error('Failed to update master data:', e)
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
