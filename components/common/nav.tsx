/* eslint-disable */
import { HamburgerIcon } from '@chakra-ui/icons'
import {
  IconButton,
  Menu,
  MenuButton,
  MenuDivider,
  MenuGroup,
  MenuItem,
  MenuList,
} from '@chakra-ui/react'
import NextLink from 'next/link'
import React from 'react'
import { LangMenuItem } from './lang-menu-item'

export const menuGroups = [
  {
    title: 'Tools',
    items: [
      {
        href: '/material',
        label: { ja: '育成素材計算機', en: 'Material Calculator' },
      },
      { href: '/farming', label: { ja: '周回ソルバー', en: 'Farming Solver' } },
      {
        href: '/servants',
        label: { ja: 'サーヴァント一覧', en: 'Sarvant List' },
      },
      { href: '/items', label: { ja: 'アイテム一覧', en: 'Item List' } },
      { href: '/cloud', label: { ja: 'クラウドセーブ', en: 'Save to Cloud' } },
    ],
  },
  {
    title: 'Docs',
    items: [
      { href: '/docs', label: { ja: '使い方', en: 'About' } },
      { href: '/news', label: { ja: 'お知らせ', en: 'News' } },
      { href: '/LICENSE', label: { ja: 'License', en: 'License' } },
    ],
  },
]

export const Nav = () => {
  const locale = 'ja' as string
  return (
    <nav>
      <Menu>
        <MenuButton
          as={IconButton}
          aria-label="Menu"
          icon={<HamburgerIcon />}
          size="md"
          variant="ghost"
          color="var(--gold)"
          _hover={{ color: 'var(--gold2)', bg: 'rgba(154,114,36,0.1)' }}
          _active={{ color: 'var(--gold2)', bg: 'rgba(154,114,36,0.15)' }}
        />
        <MenuList bg="var(--panel)" borderColor="var(--gold-dim)" backdropFilter="blur(20px)" py={2}>
          {menuGroups.map(({ title, items }) => (
            <MenuGroup title={title} key={title} color="var(--gold)" fontSize="10px" letterSpacing="0.1em">
              {items.map(({ href, label }) => (
                <NextLink href={href} key={href}>
                  <MenuItem
                    bg="transparent"
                    color="var(--text)"
                    fontSize="13px"
                    _hover={{ bg: 'rgba(154,114,36,0.15)', color: 'var(--gold2)' }}
                    _focus={{ bg: 'rgba(154,114,36,0.15)', color: 'var(--gold2)' }}
                  >
                    {label[(locale ?? 'ja') as 'en' | 'ja']}
                  </MenuItem>
                </NextLink>
              ))}
            </MenuGroup>
          ))}
          <MenuDivider borderColor="rgba(154,114,36,0.2)" />
          <LangMenuItem />
        </MenuList>
      </Menu>
    </nav>
  )
}
