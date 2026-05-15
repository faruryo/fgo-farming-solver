'use client'

import { Button } from '@/components/ui/button'
import { MdTranslate } from 'react-icons/md'
import { useToggleLocale } from '../../hooks/use-toggle-locale'

export const LangButton = () => {
  const [locale, toggleLocale] = useToggleLocale()
  const label = locale == 'en' ? '言語を変更' : 'Change language'

  return (
    <Button onClick={toggleLocale} aria-label={label} size="icon" variant="ghost">
      <MdTranslate size={20} />
    </Button>
  )
}
