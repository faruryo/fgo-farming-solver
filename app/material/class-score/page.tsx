import type { Metadata } from 'next'
import { ClassScoreIndex } from '../../../components/class-score'

export const metadata: Metadata = {
  title: 'クラススコア目標シミュレータ | FGO Farming Solver',
  description:
    'FGOのクラススコア最大解放に必要な素材（モニュピ・通常素材・QP・星光の砂・トーチ）をシミュレーションし、素材目標へ合算します。',
}

export default function ClassScorePage() {
  return <ClassScoreIndex />
}
