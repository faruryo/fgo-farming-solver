'use client'

import { Link } from '../common/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import React from 'react'
import { PageSelect } from './material-page-select'
import { classNames } from '../../lib/class-names'
import { useTranslation } from 'react-i18next'

export const Pagination = ({
  currentClassName,
}: {
  currentClassName?: string
}) => {
  const { i18n } = useTranslation()
  const locale = (i18n.language || 'ja') as 'ja' | 'en'
  const localClassNames = classNames[locale]
  const keys = Object.keys(localClassNames)
  const currentIndex = keys.indexOf(currentClassName || '')
  const prevClassName =
    currentIndex < 1 ? keys.slice(-1)[0] : keys[currentIndex - 1]
  const nextClassName = keys[currentIndex + 1] ?? keys[0]

  return (
    <nav
      aria-label="pagination"
      className="flex flex-col sm:flex-row items-center justify-between gap-4"
    >
      <Link href={'/material/' + prevClassName}>
        <div className="flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          <span className="pr-5">{localClassNames[prevClassName as keyof typeof localClassNames]}</span>
        </div>
      </Link>

      <div>
        <PageSelect currentClassName={currentClassName} />
      </div>

      <Link href={'/material/' + nextClassName}>
        <div className="flex items-center gap-1">
          <span className="pl-5">{localClassNames[nextClassName as keyof typeof localClassNames]}</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </Link>
    </nav>
  )
}
