import { useRouter } from 'next/router'
import { sumMaterials } from '../../lib/sum-materials'
import { Button, ButtonProps } from '@chakra-ui/button'
import { ComponentWithAs } from '@chakra-ui/system'
import { ChaldeaState } from '../../hooks/create-chaldea-state'
import { useBoolean } from '@chakra-ui/hooks'
import { MaterialsForServants } from '../../lib/get-materials'
import { useTranslation } from 'react-i18next'

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
