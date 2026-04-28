import { HamburgerIcon } from '@chakra-ui/icons'
import {
  IconButton,
  Menu,
  MenuButton,
  MenuDivider,
  MenuGroup,
  MenuItem,
  MenuList,
  Box,
  Text,
  HStack,
  Switch,
  FormControl,
  FormLabel,
  Button,
  Spinner,
} from '@chakra-ui/react'
import NextLink from 'next/link'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useCloudSync } from '../../hooks/use-cloud-sync'
import { LangMenuItem } from './lang-menu-item'

export const menuGroups = [
  {
    title: 'Tools',
    items: [
      { href: '/material',         label: { ja: '育成素材計算機', en: 'Material Calculator' } },
      { href: '/farming',          label: { ja: '周回ソルバー',   en: 'Farming Solver' } },
      { href: '/farming/history',  label: { ja: '計算履歴',       en: 'History' } },
    ],
  },
  {
    title: 'Reference',
    items: [
      { href: '/servants', label: { ja: 'サーヴァント一覧', en: 'Servants' } },
      { href: '/items',    label: { ja: 'アイテム一覧',     en: 'Items' } },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/cloud', label: { ja: 'データ管理', en: 'Data Management' } },
    ],
  },
  {
    title: 'Docs',
    items: [
      { href: '/docs',    label: { ja: '使い方',    en: 'About' } },
      { href: '/news',    label: { ja: 'お知らせ',  en: 'News' } },
      { href: '/LICENSE', label: { ja: 'License',   en: 'License' } },
    ],
  },
]

const AuthStatus = () => {
  const { session } = useCloudSync()
  return (
    <Box px={3} py={2}>
      <HStack spacing={2}>
        <Box w="7px" h="7px" borderRadius="50%" flexShrink={0}
          bg={session?.user ? 'var(--ok)' : 'var(--text3)'} />
        {session?.user ? (
          <Text fontSize="11px" color="var(--text2)" noOfLines={1} flex={1}>
            {session.user.name}
          </Text>
        ) : (
          <>
            <Text fontSize="11px" color="var(--text3)">未ログイン</Text>
            <NextLink href="/cloud">
              <Text fontSize="10px" color="var(--steel)" textDecoration="underline" _hover={{ color: 'var(--gold)' }}>
                ログイン
              </Text>
            </NextLink>
          </>
        )}
      </HStack>
    </Box>
  )
}

const CloudSyncContent = () => {
  const { t } = useTranslation('common')
  const {
    session,
    cloudData,
    isSaving,
    saveStatus,
    autoSyncEnabled,
    toggleAutoSync,
    hasConflict,
  } = useCloudSync()

  if (!session && process.env.NODE_ENV !== 'development') return null

  const isUpToDate = (saveStatus === true || !cloudData) && !hasConflict

  return (
    <Box px={3} py={2} mb={1}>
      <HStack justify="space-between" mb={3}>
        <HStack spacing={2}>
          <Box position="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hasConflict ? 'var(--red)' : isUpToDate ? 'var(--gold-dim)' : 'var(--gold)'} strokeWidth="2">
              <path d="M17.5 19c.7 0 1.3-.2 1.8-.7.5-.5.7-1.1.7-1.8 0-.5-.1-.9-.4-1.3-.2-.4-.6-.7-1-.9 0-.1 0-.2.1-.3 0-1.4-.5-2.6-1.5-3.5-1-.9-2.1-1.4-3.5-1.4-.9 0-1.8.2-2.6.7-.8.5-1.4 1.1-1.8 1.9-.3-.1-.6-.2-.9-.2-1.1 0-2.1.4-2.8 1.2s-1.1 1.7-1.1 2.8c0 1.1.4 2.1 1.2 2.8.8.8 1.7 1.2 2.8 1.2h10z" />
            </svg>
            {hasConflict && (
              <Box position="absolute" top="-2px" right="-2px" w="6px" h="6px" bg="var(--red)" borderRadius="50%" border="1px solid var(--panel)" animation="pulse 2s infinite" />
            )}
          </Box>
          <Text fontSize="10px" color={hasConflict ? 'var(--red)' : 'var(--gold)'} fontWeight="bold" letterSpacing="0.05em">
            {hasConflict ? 'SYNC CONFLICT' : 'CLOUD SYNC'}
          </Text>
        </HStack>
        {isSaving && <Spinner size="xs" color="var(--gold)" />}
      </HStack>

      {hasConflict ? (
        <NextLink href="/cloud">
          <Button
            width="100%"
            size="xs"
            variant="ghost"
            bg="rgba(255,0,0,0.1)"
            color="var(--red)"
            fontSize="10px"
            height="32px"
            _hover={{ bg: 'rgba(255,0,0,0.15)' }}
          >
            解決のためにデータ管理へ
          </Button>
        </NextLink>
      ) : (
        <FormControl display="flex" alignItems="center">
          <FormLabel htmlFor="nav-auto-sync" mb="0" fontSize="11px" color="var(--text2)" flex="1">
            {t('auto-sync-label', '同期の自動化')}
          </FormLabel>
          <Switch
            id="nav-auto-sync"
            isChecked={autoSyncEnabled}
            onChange={toggleAutoSync}
            colorScheme="gold"
            size="sm"
            sx={{
              'span.chakra-switch__track:not([data-checked])': {
                bg: 'rgba(154,114,36,0.15)',
              },
            }}
          />
        </FormControl>
      )}
    </Box>
  )
}

export const Nav = () => {
  const { i18n } = useTranslation()
  const locale = i18n.language
  
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
        <MenuList bg="var(--panel)" borderColor="var(--gold-dim)" backdropFilter="blur(20px)" py={2} width="220px">
          <AuthStatus />
          <MenuDivider borderColor="rgba(154,114,36,0.1)" />
          <CloudSyncContent />
          <MenuDivider borderColor="rgba(154,114,36,0.1)" />
          
          {menuGroups.map(({ title, items }) => (
            <MenuGroup title={title} key={title} color="var(--gold)" fontSize="10px" letterSpacing="0.1em">
              {items.map(({ href, label }) => (
                <NextLink href={href} key={href} passHref>
                  <MenuItem
                    as="span"
                    bg="transparent"
                    color="var(--text)"
                    fontSize="13px"
                    _hover={{ bg: 'rgba(154,114,36,0.15)', color: 'var(--gold2)' }}
                    _focus={{ bg: 'rgba(154,114,36,0.15)', color: 'var(--gold2)' }}
                    display="block"
                    py={2}
                  >
                    {label[(locale ?? 'ja') as 'en' | 'ja']}
                  </MenuItem>
                </NextLink>
              ))}
            </MenuGroup>
          ))}
          <MenuDivider borderColor="rgba(154,114,36,0.1)" />
          <LangMenuItem />
        </MenuList>
      </Menu>
    </nav>
  )
}
