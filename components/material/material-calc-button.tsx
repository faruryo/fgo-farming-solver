'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChaldeaState } from '../../hooks/create-chaldea-state'
import { MaterialsForServants } from '../../lib/get-materials'
import { computeServantResult } from '../../lib/required-materials'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'

export const CalcButton = ({
  state,
  materials,
  className,
}: {
  state: ChaldeaState
  materials: MaterialsForServants
  className?: string
}) => {
  const [calculating, setCalculating] = useState(false)
  const router = useRouter()
  const { t } = useTranslation('material')
  const calc = () => {
    setCalculating(true)
    // 育成ぶんだけを保存する。クラススコアぶんは読むときに足す。
    const result = computeServantResult(state, materials)
    localStorage.setItem(STORAGE_KEYS.MATERIAL_SERVANT_RESULT, JSON.stringify(result))
    // 同じ画面の読み手に知らせる（同期の対象外のキーなので未保存の変更にはならない）
    window.dispatchEvent(
      new CustomEvent('ls-sync', { detail: { key: STORAGE_KEYS.MATERIAL_SERVANT_RESULT } })
    )
    router.push('/material/result')
  }
  return (
    <Button onClick={calc} disabled={calculating} className={className}>
      {calculating && <span className="animate-spin mr-2">⟳</span>}
      {t('必要な素材を計算する')}
    </Button>
  )
}
