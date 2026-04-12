'use client'

import { Button, ButtonProps, useBoolean } from '@chakra-ui/react'
import { ComponentWithAs } from '@chakra-ui/react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { ChaldeaState } from '../../hooks/create-chaldea-state'
import { MaterialsForServants } from '../../lib/get-materials'
import { sumMaterials } from '../../lib/sum-materials'

export const CalcButton: ComponentWithAs<
  'button',
  ButtonProps & {
    state: ChaldeaState
    materials: MaterialsForServants
  }
> = ({ state, materials, ...props }) => {
  const [calculating, setCalculating] = useBoolean()
  const router = useRouter()
  const { t } = useTranslation('material')
  const calc = () => {
    setCalculating.on()
    const result = sumMaterials(state, materials)
    localStorage.setItem('material/result', JSON.stringify(result))
    router.push('/material/result')
  }
  return (
    <Button onClick={calc} isLoading={calculating} {...props}>
      {t('必要な素材を計算する')}
    </Button>
  )
}
