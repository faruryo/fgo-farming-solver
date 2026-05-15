import { Button } from '@/components/ui/button'
import React from 'react'
import { FaXTwitter } from 'react-icons/fa6'
import { GithubMenu } from './github-menu'
import { Link, ExternalLink } from './link'
import { menuGroups } from './nav'

export const Footer = () => {
  const locale = 'ja' as string
  return (
    <footer>
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="flex flex-wrap">
          {menuGroups.map(({ title, items }) => (
            <div
              key={title}
              className="flex flex-col md:flex-row md:items-center gap-2 min-w-[200px] mx-4 my-4 md:my-2"
            >
              <h6 className="text-xs font-semibold">{title}</h6>
              {items.map(({ href, label }) => (
                <Link href={href} key={href}>
                  {label[(locale ?? 'ja') as 'ja' | 'en']}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <GithubMenu aria-label="Github Repositories" />
            <Button
              size="icon"
              variant="ghost"
              render={
                <a
                  href="https://x.com/TechFaru"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X (Twitter)"
                />
              }
            >
              <FaXTwitter size={24} />
            </Button>
          </div>
          <p>
            <Link href="/LICENSE" color="inherit">
              © 2021 antenna-three
            </Link>
          </p>
          <p>
            Data from{' '}
            <ExternalLink href="https://atlasacademy.io" color="inherit">
              Atlas Academy
            </ExternalLink>{' '}
            and{' '}
            <ExternalLink
              href="https://sites.google.com/view/fgo-domus-aurea"
              color="inherit"
            >
              FGOアイテム効率劇場
            </ExternalLink>
          </p>
        </div>
      </div>
    </footer>
  )
}
