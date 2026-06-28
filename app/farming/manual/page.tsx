import { getDrops } from '../../../lib/get-drops'
import { getLocalQuests } from '../../../lib/get-local-quests'
import { getLocalItems } from '../../../lib/get-local-items'
import { Index } from '../../../components/farming'

export const dynamic = 'force-dynamic'

/**
 * 手入力で周回ソルバーを使う入口。空フォームから自分でアイテム/個数を入力する。
 * goSolver(育成計算機由来・プレフィル)の着地は `/farming`、こちらは手入力専用に導線を分離している。
 * UI は `/farming` と同じ `Index` を共有（パラメータが無いので空フォームで開く）。
 */
export default async function FarmingManualPage() {
  const locale = 'ja' // TODO: locale handling
  const { items, quests } = await getDrops()
  const [localItems, localQuests] = await Promise.all([
    getLocalItems(items, locale),
    getLocalQuests(quests, locale),
  ])

  return (
    <Index
      items={localItems}
      quests={localQuests}
    />
  )
}
