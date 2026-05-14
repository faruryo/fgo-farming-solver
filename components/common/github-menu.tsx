 
import { ButtonProps, IconButton, IconButtonProps } from '@chakra-ui/react'
import {
  Menu,
  MenuButton,
  MenuButtonProps,
  MenuItem,
  MenuList,
} from '@chakra-ui/react'
import React from 'react'

const repos: { repo: string; label: { [locale: string]: string } }[] = [
  {
    repo: 'fgo-farming-solver',
    label: { ja: 'フロントエンド', en: 'Front end' },
  },
  { repo: 'fgo-farming-solver-api', label: { ja: 'API', en: 'API' } },
  { repo: 'fgodrop', label: { ja: 'スクレイピング', en: 'Scraping' } },
]

export const GithubMenu = (
  props: MenuButtonProps & ButtonProps & IconButtonProps
) => {
  const locale = 'ja' as string
  return (
    <Menu>
      <MenuButton as={IconButton} {...props} />
      <MenuList>
        {repos.map(({ repo, label }) => (
          <a
            href={`https://github.com/faruryo/${repo}`}
            target="_blank"
            rel="noopener noreferrer"
            key={repo}
          >
            <MenuItem>{label[locale ?? 'ja']}</MenuItem>
          </a>
        ))}
      </MenuList>
    </Menu>
  )
}
