import { execSync } from 'child_process'

const DB_NAME = 'fgo-farming-solver-db'

// Realistic Chaldea state items and quests counts
const yesterdayData = {
  items: '10:800,11:58,12:707,13:62,14:679,16:260,18:240,19:463,20:246,21:437,23:263,25:203,28:48,50:165,00:3987,01:3485,03:3503,04:457,05:344,07:418,08:1062,0a:70,0d:119,1h:277,2a:231,2c:41,2e:50,2i:70',
  quests: '101,103,105,106',
}

const weekAgoData = {
  items: '10:900,11:100,12:850,13:62,14:679,16:260,18:240,19:463,20:246,21:437,23:263,25:203,28:48,50:165,00:3987,01:3485,03:3503,04:457,05:344,07:418,08:1062,0a:70,0d:119,1h:277,2a:231,2c:41,2e:50,2i:70',
  quests: '101,103',
}

const monthAgoData = {
  items: '10:1200,11:200,12:1000,13:200,14:900,16:500,18:400,19:800,20:500,21:800,23:500,25:400,28:100,50:300,00:4500,01:4000,03:4000,04:800,05:600,07:800,08:1500,0a:200,0d:300,1h:500,2a:400,2c:100,2e:100,2i:200',
  quests: '101',
}

const runSql = (sql: string): string => {
  try {
    const escaped = sql.replace(/"/g, '\\"')
    const cmd = `pnpm exec wrangler d1 execute ${DB_NAME} --local --command="${escaped}"`
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' })
  } catch (err: any) {
    console.error(`❌ Failed to execute SQL: ${err.message}`)
    process.exit(1)
  }
}

const getActiveUserIds = (): string[] => {
  console.log('🔍 Detecting active local user accounts from D1 database...')
  const raw = runSql("SELECT DISTINCT user_id FROM farming_results WHERE user_id != 'anonymous';")
  try {
    const startIdx = raw.indexOf('[')
    if (startIdx === -1) return []
    const parsed = JSON.parse(raw.slice(startIdx))
    const results = parsed[0]?.results || []
    return results.map((r: any) => r.user_id).filter(Boolean) as string[]
  } catch {
    return []
  }
}

const seedUser = (userId: string) => {
  console.log(`🌱 Seeding mock progress snapshots for user: ${userId}...`)

  const yesterdayStr = JSON.stringify(yesterdayData).replace(/'/g, "''")
  const weekAgoStr = JSON.stringify(weekAgoData).replace(/'/g, "''")
  const monthAgoStr = JSON.stringify(monthAgoData).replace(/'/g, "''")

  const sql = `
    INSERT OR REPLACE INTO state_snapshots (id, user_id, data, created_at) VALUES
      ('${userId}:2026-05-23', '${userId}', '${yesterdayStr}', '2026-05-23 12:00:00'),
      ('${userId}:2026-05-16', '${userId}', '${weekAgoStr}', '2026-05-16 12:00:00'),
      ('${userId}:2026-04-24', '${userId}', '${monthAgoStr}', '2026-04-24 12:00:00');
  `
  runSql(sql)
  console.log(`✅ Successfully seeded Yesterday, 1 week ago, and 1 month ago snapshots for ${userId}!`)
}

const main = () => {
  const args = process.argv.slice(2)
  let targetUsers: string[] = []

  if (args.length > 0) {
    targetUsers = [args[0]]
  } else {
    // Auto-detect from local DB
    targetUsers = getActiveUserIds()
    // Always include default test accounts for convenience
    const defaults = ['dev-user', '102899322868388443995', '118314056864811158814']
    for (const d of defaults) {
      if (!targetUsers.includes(d)) {
        targetUsers.push(d)
      }
    }
  }

  console.log(`✨ FGO Farming Solver - Local D1 Progress Seeder ✨`)
  console.log(`-----------------------------------------------`)
  for (const user of targetUsers) {
    seedUser(user)
  }
  console.log(`-----------------------------------------------`)
  console.log(`🎉 Seeding complete! All set for local progress report testing.`)
}

main()
