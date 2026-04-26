/* eslint-disable */
'use client'

import {
  Alert,
  AlertIcon,
  Button,
  ButtonGroup,
  Checkbox,
  FormControl,
  FormLabel,
  useBoolean,
  VStack,
} from '@chakra-ui/react'
import { useRouter, useSearchParams } from 'next/navigation'
import React, {
  ChangeEventHandler,
  useCallback,
  useEffect,
  useMemo,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useCheckboxTree } from '../../hooks/use-checkbox-tree'
import { useChecked } from '../../hooks/use-checked-from-quest-state'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { useQuestTree } from '../../hooks/use-quest-tree'
import { Item, Quest } from '../../interfaces/fgodrop'
import { Localized } from '../../lib/get-local-items'
import { groupBy } from '../../utils/group-by'
import { CheckboxTree } from '../common/checkbox-tree'
import { ItemFieldset } from './item-fieldset'
import { ObjectiveFieldset } from './objective-fieldset'
import { ResetAlertDialog } from './reset-alert-dialog'

export type FarmingIndexProps = {
  items: Localized<Item>[]
  quests: Quest[]
}

type InputState = {
  objective: string
  itemCounts: { [key: string]: string }
  checkedQuests: string[]
  halfDailyAp: boolean
}
type QueryInputState = {
  objective?: string
  items: string
  quests?: string
  ap_coefficients?: string
}

const inputToQuery = ({
  objective,
  itemCounts,
  checkedQuests,
  halfDailyAp,
}: InputState) => ({
  objective,
  items: Object.entries(itemCounts)
    .filter(([, count]) => count != '')
    .map(([item, count]) => item + ':' + count)
    .join(','),
  quests: checkedQuests
    .reduce(
      (acc, cur) =>
        acc.includes(cur[0]) || acc.includes(cur.slice(0, 2))
          ? acc
          : [...acc, cur],
      [] as string[]
    )
    .join(','),
  ap_coefficients: halfDailyAp ? '0:0.5' : '',
})

const migrateLocalInput = () => {
  const json = localStorage.getItem('input')
  if (json == null || json == 'undefined') {
    return
  }
  const input = JSON.parse(json) as unknown
  if (typeof input == 'object' && input != null) {
    Object.entries(input).forEach(([key, value]) =>
      localStorage.setItem(key, JSON.stringify(value))
    )
  }
  localStorage.removeItem('input')
}
const hasItems = (arg: unknown): arg is { items: unknown } =>
  typeof arg == 'object' && arg != null && 'items' in arg

const isInputState = (arg: unknown): arg is QueryInputState =>
  hasItems(arg) && typeof arg.items == 'string'

const hasId = (arg: unknown): arg is { id: unknown } =>
  typeof arg == 'object' && arg != null && 'id' in arg

export const Index = ({ items, quests }: FarmingIndexProps) => {
  useEffect(migrateLocalInput, [])
  const { t } = useTranslation('farming')
  const { tree } = useQuestTree(quests)
  const questIds = quests.map(({ id }) => id)
  const initialItemCounts = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, ''])),
    [items]
  )
  const [objective, setObjective] = useLocalStorage('objective', 'ap')
  const [itemCounts, setItemCounts] = useLocalStorage(
    'items',
    initialItemCounts
  )
  const [checkedQuests, setCheckedQuests] = useLocalStorage('quests', questIds)
  const [halfDailyAp, setHalfDailyAp] = useLocalStorage('halfDailyAp', false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isConfirming, setIsConfirming] = useBoolean()
  const [isLoading, setIsLoading] = useBoolean(false)
  const [selected, setSelected] = useChecked(
    questIds,
    checkedQuests,
    setCheckedQuests
  )
  const { checked, onCheck, expanded, onExpand } = useCheckboxTree(
    tree,
    selected,
    setSelected
  )

  useEffect(() => {
    if (!searchParams) return
    const query = Object.fromEntries(searchParams.entries())
    if (isInputState(query)) {
      setObjective((objective) => query.objective ?? objective)
      setItemCounts(
        (itemCounts) =>
          Object.fromEntries(
            query.items
              .split(',')
              .map((itemCount) => itemCount.split(':', 2) as [string, string])
          ) ?? itemCounts
      )
      setCheckedQuests((checkedQuests) => {
        const { quests } = query
        if (quests == null) {
          return checkedQuests
        } else {
          return questIds.filter(
            (id) =>
              quests.includes(id[0]) ||
              quests.includes(id.slice(0, 2)) ||
              quests.includes(id)
          )
        }
      })
      setHalfDailyAp(query.ap_coefficients == '0:0.5')
      router.replace('/farming')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setIsLoading.on()
      const query = inputToQuery({
        objective,
        itemCounts,
        checkedQuests,
        halfDailyAp,
      })
      const params = new URLSearchParams({ ...query, fields: 'id' })
      const url = `/api/solve?${params.toString()}`
      const result = await fetch(url).then((res) => res.json() as unknown)
      if (hasId(result) && typeof result.id == 'string') {
        const url = `/farming/results/${result.id}`
        localStorage.setItem('farming/results', url)
        await router.push(url)
      } else {
        await router.push('/500')
      }
    },
    [
      checkedQuests,
      halfDailyAp,
      itemCounts,
      objective,
      router,
      setIsLoading,
    ]
  )

  const onReset = useCallback(() => {
    setObjective('ap')
    setItemCounts(initialItemCounts)
    setCheckedQuests(questIds)
    setHalfDailyAp(false)
  }, [
    initialItemCounts,
    questIds,
    setCheckedQuests,
    setHalfDailyAp,
    setItemCounts,
    setObjective,
  ])

  const handleItemChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const { name, value } = event.currentTarget
      setItemCounts((itemCounts) => ({ ...itemCounts, [name]: value }))
    },
    [setItemCounts]
  )
  const handleHalfDailyApChange = useCallback<
    ChangeEventHandler<HTMLInputElement>
  >(
    (event) => {
      const { checked } = event.currentTarget
      setHalfDailyAp(checked)
    },
    [setHalfDailyAp]
  )

  const itemGroups = Object.entries(
    groupBy(items, ({ largeCategory }) => largeCategory)
  ).map(([largeCategory, items]): [string, [string, Localized<Item>[]][]] => [
    largeCategory,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    Object.entries(groupBy(items, ({ category }) => category)) as any,
  ])

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="c-page-header">
          <div>
            <div className="c-page-en">FARMING SOLVER</div>
            <h1 className="c-page-title">{t('周回効率計算')}</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <VStack alignItems="start" spacing={8}>
            <ObjectiveFieldset objective={objective} setObjective={setObjective} />
            <ItemFieldset
              itemGroups={itemGroups}
              inputItems={itemCounts}
              handleChange={handleItemChange}
            />
            {Object.values(itemCounts).every((count) => count == '') && (
              <Alert status="error">
                <AlertIcon />
                {t('集めたいアイテムの数を最低1つ入力してください。')}
              </Alert>
            )}
            <FormControl as="fieldset">
              <FormLabel as="legend" className="c-settings-section-label" m={0} mb={4} display="flex">
                {t('周回対象に含めるクエスト')}
              </FormLabel>
              <div className="c-card" style={{ width: '100%', padding: '20px' }}>
                <CheckboxTree
                  tree={tree}
                  checked={checked}
                  onCheck={onCheck}
                  expanded={expanded}
                  onExpand={onExpand}
                />
              </div>
            </FormControl>
            {checkedQuests.length == 0 && (
              <Alert status="error">
                <AlertIcon />
                {t('周回対象に含めるクエストを最低1つ選択してください。')}
              </Alert>
            )}

            <div className="c-card" style={{ width: '100%', padding: '20px', background: 'rgba(30,46,74,0.02)' }}>
              <VStack align="start" spacing={6}>
                <FormControl as="fieldset">
                  <FormLabel as="legend" className="c-settings-section-label" m={0} mb={3} display="flex">
                    {t('キャンペーン')}
                  </FormLabel>
                  <Checkbox colorScheme="blue" isChecked={halfDailyAp} onChange={handleHalfDailyApChange}>
                    {t('修練場AP半減')}
                  </Checkbox>
                </FormControl>

              </VStack>
            </div>

            <div className="c-farming-footer">
              <ButtonGroup spacing={4}>
                <Button
                  type="submit"
                  disabled={
                    Object.values(itemCounts).every((count) => count == '') ||
                    checkedQuests.length == 0
                  }
                  className="c-farming-btn"
                  isLoading={isLoading}
                  p={8}
                >
                  <span className="c-farming-btn-en">SOLVE FARMING</span>
                  <span className="c-farming-btn-jp">{t('周回数を求める')}</span>
                </Button>
                <Button
                  type="button"
                  onClick={setIsConfirming.on}
                  p={8}
                  className="c-farming-btn-reset"
                >
                  {t('リセット')}
                </Button>
              </ButtonGroup>
            </div>

            <ResetAlertDialog
              isOpen={isConfirming}
              onClose={setIsConfirming.off}
              onReset={onReset}
            />
          </VStack>
        </form>
      </div>
    </div>
  )
}
