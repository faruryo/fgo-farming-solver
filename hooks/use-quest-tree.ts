import { groupBy } from '../utils/group-by'
import { useMemo } from 'react'
import { Node } from '../components/common/checkbox-tree'

/** NEW バッジの表示期間（日）。`addedAt` からこの日数以内のクエストを新着扱いする。 */
export const NEW_QUEST_WINDOW_DAYS = 30

const isNewQuest = (addedAt: string | undefined, now: number): boolean =>
  addedAt != null &&
  now - Date.parse(addedAt) < NEW_QUEST_WINDOW_DAYS * 86_400_000

export const useQuestTree = (
  quests: {
    section: string
    area: string
    name: string
    id: string
    addedAt?: string
  }[]
): { ids: string[]; tree: Node[] } =>
  useMemo(() => {
    // 30日窓の NEW 判定には現在時刻が必要。日単位の判定なので再レンダー間の揺らぎは表示に影響しない。
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    const ids: string[] = []
    const tree = Object.entries(groupBy(quests, ({ id }) => id[0])).map(
      ([sectionId, quests]) => {
        ids.push(sectionId)
        const section = quests[0].section
        let sectionNewCount = 0
        const subtree = Object.entries(
          groupBy(quests, ({ id }) => id.slice(0, 2))
        ).map(([areaId, quests]) => {
          ids.push(areaId)
          const area = quests[0].area
          let areaNewCount = 0
          const children = quests.map(({ id, name, addedAt }): Node => {
            ids.push(id)
            if (isNewQuest(addedAt, now)) {
              areaNewCount++
              return { value: id, label: name, newCount: 1 }
            }
            return { value: id, label: name }
          })
          sectionNewCount += areaNewCount
          const node: Node = { label: area, value: areaId, children }
          // 折りたたみ対策: 配下の新着件数を親にバブルアップして気づけるようにする
          if (areaNewCount > 0) node.newCount = areaNewCount
          return node
        })
        const node: Node = { label: section, value: sectionId, children: subtree }
        if (sectionNewCount > 0) node.newCount = sectionNewCount
        return node
      }
    )
    return { ids, tree }
  }, [quests])
