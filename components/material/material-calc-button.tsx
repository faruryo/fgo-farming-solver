'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChaldeaState } from '../../hooks/create-chaldea-state'
import { MaterialsForServants } from '../../lib/get-materials'
import { sumMaterials } from '../../lib/sum-materials'

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
    const result = sumMaterials(state, materials)
    localStorage.setItem('material/result', JSON.stringify(result))
    router.push('/material/result')
  }
  return (
    <Button onClick={calc} disabled={calculating} className={className}>
      {calculating && <span className="animate-spin mr-2">⟳</span>}
      {t('必要な素材を計算する')}
    </Button>
  )
}
