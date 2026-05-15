import { Label } from '@/components/ui/label'
import React, { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { ChaldeaState } from '../../hooks/create-chaldea-state'
import { Item, Servant } from '../../interfaces/atlas-academy'
import { MsItemsIo } from './ms-items-io'
import { MsServantsIo } from './ms-servants-io'

export const MsIo = ({
  servants,
  state,
  setState,
  items,
  posession,
  setPosession,
}: {
  servants: Servant[]
  state: ChaldeaState
  setState: Dispatch<SetStateAction<ChaldeaState>>
  items: Item[]
  posession: { [key: string]: number }
  setPosession: Dispatch<SetStateAction<{ [key: string]: number }>>
}) => {
  const { t } = useTranslation('material')
  return (
    <div className="flex flex-wrap gap-4">
      <div>
        <Label htmlFor="ms-servants">{t('サーヴァント')}</Label>
        <MsServantsIo servants={servants} state={state} setState={setState} />
      </div>
      <div>
        <Label htmlFor="ms-items">{t('アイテム')}</Label>
        <MsItemsIo
          items={items}
          posession={posession}
          setPosession={setPosession}
        />
      </div>
    </div>
  )
}
