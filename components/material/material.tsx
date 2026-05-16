'use client'

import React, { useMemo } from 'react'
import { useChaldeaState } from '../../hooks/use-chaldea-state'
import { getClassNode } from '../../hooks/use-servant-tree'
import { useChecked } from '../../hooks/use-checked-from-chaldea-state'
import { useCheckboxTree } from '../../hooks/use-checkbox-tree'
import { getClassName } from '../../lib/class-names'
import { NiceServant, ClassName } from '../../interfaces/atlas-academy'
import { MaterialsForServants } from '../../lib/get-materials'
import { Link } from '../common/link'
import { Head } from '../common/head'
import { BreadcrumbLink } from '../common/breadcrumb-link'
import { CheckboxTree } from '../common/checkbox-tree'
import { CalcButton } from './material-calc-button'
import { Pagination } from './material-pagination'
import { ServantLevelSelect } from './servant-level-select'
import { useTranslation } from 'react-i18next'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

export type MaterialProps = {
  servants: NiceServant[]
  materials: MaterialsForServants
  className: string
  locale?: string
}

export const Material = ({
  servants,
  materials,
  className,
  locale = 'ja',
}: MaterialProps) => {
  const ids = useMemo(() => servants.map(({ id }) => id.toString()), [servants])
  const [chaldeaState, setChaldeaState] = useChaldeaState(ids)
  const currentClassServants = useMemo(
    () => servants.filter((servant) => servant.className == className),
    [className, servants]
  )
  const enabledServants = useMemo(
    () =>
      currentClassServants.filter(
        (servant) => !chaldeaState[servant.id.toString()]?.disabled
      ),
    [chaldeaState, currentClassServants]
  )
  const localClassName = getClassName(className as ClassName, locale)
  const { t } = useTranslation('material')

  const tree = useMemo(
    () => [getClassNode(className as ClassName, currentClassServants, locale)],
    [className, currentClassServants, locale]
  )
  const [selected, setSelected] = useChecked(chaldeaState, setChaldeaState)
  const { checked, onCheck, expanded, onExpand } = useCheckboxTree(
    tree,
    selected,
    setSelected
  )

  return (
    <div className="flex flex-col gap-8">
      <Head title={`${localClassName} | 育成素材計算機`} />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/material">
              {t('育成素材計算機')}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{localClassName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold mb-2">{t('サーヴァント選択')}</h2>
        <CheckboxTree
          tree={tree}
          checked={checked}
          onCheck={onCheck}
          expanded={expanded}
          onExpand={onExpand}
        />
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold mb-2">{t('個別設定')}</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-10">
          {enabledServants.map(({ id, name }) => (
            <div className="flex flex-col gap-4 max-w-md" key={id}>
              <h2 className="text-xl font-semibold">
                <Link href={`/servants/${id}`}>{name}</Link>
              </h2>
              <ServantLevelSelect
                id={id.toString()}
                servantState={chaldeaState[id.toString()]}
                setState={setChaldeaState}
              />
            </div>
          ))}
        </div>
      </div>
      {enabledServants.length == 0 && (
        <p>
          {locale == 'en'
            ? ''
            : `${localClassName}のサーヴァントは選択されていません。`}
        </p>
      )}
      <Pagination currentClassName={className} />
      <div className="self-center">
        <CalcButton
          state={chaldeaState}
          materials={materials}
        />
      </div>
    </div>
  )
}
