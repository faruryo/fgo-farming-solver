import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CLASS_SCORE_CLASS_KEYS } from '../../../../lib/class-score/types'
import { getClassBoardData } from '../../../../lib/class-score/board-loader'
import { BoardView } from '../../../../components/class-score/board-view'

type PageProps = {
  params: Promise<{
    className: string
  }>
}

export function generateStaticParams() {
  return CLASS_SCORE_CLASS_KEYS.map((className) => ({
    className,
  }))
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { className } = await params
  const validKey = CLASS_SCORE_CLASS_KEYS.find((k) => k === className)
  if (!validKey) {
    return { title: 'Not Found | FGO Farming Solver' }
  }

  const board = getClassBoardData(validKey)
  const title = board
    ? `${board.name}のクラススコア盤面 | FGO Farming Solver`
    : 'クラススコア盤面 | FGO Farming Solver'

  return {
    title,
    description: `FGOの${board?.name ?? ''}クラススコア盤面シミュレータ。サインごとの目標・解放設定やルート探索、必要素材計算が可能です。`,
  }
}

export default async function ClassBoardDetailPage(
  props: Readonly<PageProps>,
) {
  const { className } = await props.params
  const validKey = CLASS_SCORE_CLASS_KEYS.find((k) => k === className)

  if (!validKey) {
    notFound()
  }

  const board = getClassBoardData(validKey)
  if (!board) {
    notFound()
  }

  return <BoardView board={board} />
}
