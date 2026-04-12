/* eslint-disable */
/* eslint-disable */
'use client'

import { Box, Button, Checkbox, Text, VStack } from '@chakra-ui/react'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { FormEvent, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { useSelectOnFocus } from '../../hooks/use-select-on-focus'
import { Item } from '../../interfaces/atlas-academy'
import { toApiItemId } from '../../lib/to-api-item-id'
import { groupBy } from '../../utils/group-by'
import { Title } from '../common/title'
import { ResultAccordion } from './result-accordion'
import { TargetCategorySelect } from './target-category-select'

export type MaterialResultProps = {
  items: Item[]
  locale?: string
}

export const Result = ({ items = [], locale = 'ja' }: MaterialResultProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = Object.fromEntries(searchParams?.entries() ?? [])
  const initialAmounts = Object.fromEntries(
    Object.entries(query).map(([k, v]) => [
      k,
      parseInt(typeof v == 'string' ? v : '0') || 0,
    ])
  )
  const [amounts] = useLocalStorage<Record<string, number>>('material/result', initialAmounts)
  
  const requiredItems = useMemo(
    () => items.filter((item) => item.id.toString() in amounts),
    [amounts, items]
  )
  
  const [possession, setPosession] = useLocalStorage<
    Record<string, number | undefined>
  >('posession', Object.fromEntries(requiredItems.map((item) => [item.id.toString(), 0])))
  
  const [hideSufficient, setHideSufficient] = useState(false)
  const commonItems = locale == 'en' ? 'Common Items' : '強化素材'
  const [targetCategories, setTargetCategories] = useState([commonItems])
  
  const onChangeSufficient = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      setHideSufficient(event.currentTarget.checked)
    },
    []
  )
  
  const onChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      const { name, valueAsNumber } = event.currentTarget
      setPosession((state) => ({
        ...state,
        [name]: isNaN(valueAsNumber) ? undefined : valueAsNumber,
      }))
    },
    [setPosession]
  )
  
  const deficiencies = Object.fromEntries(
    requiredItems.map((item) => [
      item.id.toString(),
      (amounts[item.id.toString()] ?? 0) - (possession[item.id.toString()] ?? 0),
    ])
  )
  
  const goSolver = useCallback<React.FormEventHandler<HTMLFormElement>>(
    (event) => {
      event.preventDefault()
      const queryItems = requiredItems
        .filter(
          (item) =>
            deficiencies[item.id.toString()] > 0 &&
            toApiItemId(item, items) &&
            targetCategories.includes((item as any).largeCategory)
        )
        .map((item) => `${toApiItemId(item, items)}:${deficiencies[item.id.toString()]}`)
        .join(',')
      router.push(`/farming?items=${queryItems}`)
    },
    [requiredItems, router, deficiencies, items, targetCategories]
  )
  
  const filteredSufficient = useMemo(
    () => requiredItems.filter(({ id }) => (deficiencies[id.toString()] ?? 0) > 0),
    [deficiencies, requiredItems]
  )
  
  const displayedItems = hideSufficient ? filteredSufficient : requiredItems
  
  const itemGroup = useMemo(
    () =>
      Object.entries(
        groupBy(displayedItems, (item) => (item as any).largeCategory)
      ).map(([largeCategory, items]): [string, [string, Item[]][]] => [
        largeCategory,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        Object.entries(groupBy(items, (item) => (item as any).category)) as any,
      ]),
    [displayedItems]
  )
  
  const largeCategories = itemGroup
    .map(([largeCategory]) => largeCategory)
    .filter((largeCategory) => largeCategory != 'QP')
    
  const selectOnFocus = useSelectOnFocus()
  const { t } = useTranslation('material')

  return (
    <form onSubmit={goSolver}>
      <VStack spacing={8} alignItems="center">
        <Title>{t('アイテム必要数')}</Title>
        <Checkbox checked={hideSufficient} onChange={onChangeSufficient}>
          {t('不足している素材のみ表示')}
        </Checkbox>
        <Box w="xl" maxW="100vw">
          {itemGroup.length == 0 ? (
            <Text>{t('表示するアイテムがありません。')}</Text>
          ) : (
            <ResultAccordion
              itemGroup={itemGroup as any}
              amounts={amounts}
              possession={possession}
              deficiencies={deficiencies}
              onChange={onChange}
              onFocus={selectOnFocus}
            />
          )}
        </Box>
        <Box>
          <TargetCategorySelect
            categories={largeCategories}
            targetCategories={targetCategories}
            setTargetCategories={setTargetCategories}
          />
        </Box>
        <Button p={8} type="submit" colorScheme="blue">
          {t('クエスト周回数を求める')}
        </Button>
      </VStack>
    </form>
  )
}
