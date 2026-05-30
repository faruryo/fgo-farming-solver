/**
 * mocks/all.json の各クエストに報酬(qp / bondPoints / exp)を付与する(ローカル開発用)。
 * 元 CSV(FGODrop スプレッドシート)の 基本絆P / EXP / QP 列を読み、(area, name) で突合する。
 * 本番データは master-data パイプライン(update.ts)が同じ列を抽出する。
 */
import { promises as fs } from 'fs'
import path from 'path'

const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQerC77YrlI1wQaJHUlDl3VBNh3zx6YDWbF8syDM3DsoG3npubnlG68VY9GlYwRAiP5RCOqQEHZoF4c/pub?gid=1085791724&output=csv'

type Quest = { area: string; name: string; qp?: number; bondPoints?: number; exp?: number }

function parseCSV(csv: string): string[][] {
  const rows: string[][] = []
  let r: string[] = []
  let f = ''
  let q = false
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i]
    const n = csv[i + 1]
    if (q) {
      if (c === '"') {
        if (n === '"') {
          f += '"'
          i++
        } else q = false
      } else f += c
    } else {
      if (c === '"') q = true
      else if (c === ',') {
        r.push(f)
        f = ''
      } else if (c === '\r' || c === '\n') {
        r.push(f)
        if (r.length > 0) rows.push(r)
        r = []
        f = ''
        if (c === '\r' && n === '\n') i++
      } else f += c
    }
  }
  if (r.length || f) {
    r.push(f)
    rows.push(r)
  }
  return rows
}

const parseReward = (s: string | undefined): number | undefined => {
  const n = parseInt((s ?? '').replace(/,/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

const main = async () => {
  const res = await fetch(SHEET_URL)
  const rows = parseCSV(await res.text())
  const header = rows[1] ?? []
  const col = (label: string) => header.findIndex(c => (c ?? '').trim() === label)
  const bondCol = col('基本絆P')
  const expCol = col('EXP')
  const qpCol = col('QP')

  const byKey = new Map<string, { qp?: number; bondPoints?: number; exp?: number }>()
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i]
    const area = row[0]
    const name = row[1]
    if (!area || !name) continue
    byKey.set(`${area}|${name}`, {
      qp: qpCol >= 0 ? parseReward(row[qpCol]) : undefined,
      bondPoints: bondCol >= 0 ? parseReward(row[bondCol]) : undefined,
      exp: expCol >= 0 ? parseReward(row[expCol]) : undefined,
    })
  }

  const file = path.join(process.cwd(), 'mocks', 'all.json')
  const json = JSON.parse(await fs.readFile(file, 'utf-8')) as { quests: Quest[] }
  let matched = 0
  for (const q of json.quests) {
    const r = byKey.get(`${q.area}|${q.name}`)
    if (!r) continue
    if (r.qp != null) q.qp = r.qp
    if (r.bondPoints != null) q.bondPoints = r.bondPoints
    if (r.exp != null) q.exp = r.exp
    matched++
  }
  await fs.writeFile(file, JSON.stringify(json, null, 2) + '\n')
  console.log(`Done — matched ${matched}/${json.quests.length} quests with rewards.`)
}

void main()
