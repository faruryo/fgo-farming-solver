'use client'

import Image from 'next/image'
import React from 'react'
import { Link } from './link'

export const Logo = () => {
  const locale = 'ja' as string
  const space = ''
  return (
    <div>
      <Link href="/" aria-label="Go to top">
        <div className="flex items-center gap-2">
          <Image src="/hermes.png" width={32} height={32} alt="site logo" />
          <h1 className="text-lg font-semibold">
            <div className="flex flex-wrap">
              <span>FGO{space}</span>
              <span>
                {locale == 'en' ? 'Farming' : '周回'}
                {space}
              </span>
              <span>{locale == 'en' ? 'Solver' : 'ソルバー'}</span>
            </div>
          </h1>
        </div>
      </Link>
    </div>
  )
}
