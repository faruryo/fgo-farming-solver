/**
 * 周回対象素材が all_drops_json に載っているかを読み取り専用で点検する。
 * 使い方: tsx scripts/audit-craft-drop-coverage.ts <drops.json> <items.json>
 * KV へは書かない。1件でも穴があれば exit 1。
 */
import { readJson } from '../lib/read-json'
import {
  auditFarmableCraftGaps,
  formatFarmableCraftAudit,
  parseCraftAuditInputs,
} from '../lib/event-craft-data-check'

const dropsPath = process.argv[2]
const itemsPath = process.argv[3]
if (!dropsPath || !itemsPath) {
  console.error('usage: tsx scripts/audit-craft-drop-coverage.ts <drops.json> <items.json>')
  process.exit(2)
}

const main = async () => {
  const drops: unknown = await readJson(dropsPath)
  const items: unknown = await readJson(itemsPath)
  const parsed = parseCraftAuditInputs(drops, items)
  if (!parsed) {
    console.error('invalid drops or items json')
    process.exit(2)
  }
  const report = formatFarmableCraftAudit(auditFarmableCraftGaps(parsed.drops, parsed.items))
  console.log(report.text)
  process.exit(report.exitCode)
}

void main()
