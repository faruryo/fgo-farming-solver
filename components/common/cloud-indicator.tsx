'use client'

import {
  Box,
  IconButton,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverArrow,
  Text,
  VStack,
  HStack,
  Button,
  Switch,
  FormControl,
  FormLabel,
  Spinner,
  Tooltip,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { useCloudSync } from '../../hooks/use-cloud-sync'
import React from 'react'

export const CloudIndicator = () => {
  const { t } = useTranslation('common')
  const {
    session,
    cloudData,
    isSaving,
    saveStatus,
    autoSyncEnabled,
    toggleAutoSync,
    handleSave,
    hasConflict,
  } = useCloudSync()

  if (!session && process.env.NODE_ENV !== 'development') return null

  const isUpToDate = (saveStatus === true || !cloudData) && !hasConflict

  return (
    <Popover placement="bottom-end">
      <PopoverTrigger>
        <Box>
          <Tooltip label={isSaving ? 'Saving...' : hasConflict ? 'Conflicts detected (Cloud is newer)' : 'Cloud Sync'}>
            <IconButton
              aria-label="Cloud Sync"
              variant="ghost"
              size="md"
              color={isSaving ? 'var(--gold)' : hasConflict ? 'var(--red)' : isUpToDate ? 'var(--gold-dim)' : 'var(--gold)'}
              _hover={{ bg: 'rgba(154,114,36,0.1)' }}
              icon={
                <Box position="relative">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.5 19c.7 0 1.3-.2 1.8-.7.5-.5.7-1.1.7-1.8 0-.5-.1-.9-.4-1.3-.2-.4-.6-.7-1-.9 0-.1 0-.2.1-.3 0-1.4-.5-2.6-1.5-3.5-1-.9-2.1-1.4-3.5-1.4-.9 0-1.8.2-2.6.7-.8.5-1.4 1.1-1.8 1.9-.3-.1-.6-.2-.9-.2-1.1 0-2.1.4-2.8 1.2s-1.1 1.7-1.1 2.8c0 1.1.4 2.1 1.2 2.8.8.8 1.7 1.2 2.8 1.2h10z" />
                  </svg>
                  {isSaving && (
                    <Spinner
                      size="xs"
                      position="absolute"
                      top="-2px"
                      right="-2px"
                      color="var(--gold)"
                      thickness="2px"
                    />
                  )}
                  {hasConflict && (
                    <Box
                      position="absolute"
                      top="0"
                      right="0"
                      w="10px"
                      h="10px"
                      bg="var(--red)"
                      borderRadius="50%"
                      border="2px solid var(--bg)"
                      animation="pulse 2s infinite"
                    />
                  )}
                  {!isSaving && !isUpToDate && !hasConflict && (
                    <Box
                      position="absolute"
                      top="0"
                      right="0"
                      w="8px"
                      h="8px"
                      bg="var(--gold)"
                      borderRadius="50%"
                      border="2px solid var(--bg)"
                    />
                  )}
                </Box>
              }
            />
          </Tooltip>
        </Box>
      </PopoverTrigger>
      <PopoverContent
        bg="var(--panel)"
        borderColor={hasConflict ? 'var(--red)' : 'var(--gold-dim)'}
        boxShadow="0 8px 32px rgba(0,0,0,0.4)"
        backdropFilter="blur(20px)"
        width="240px"
        borderRadius="16px"
      >
        <PopoverArrow bg="var(--panel)" />
        <PopoverBody p={4}>
          <VStack spacing={4} align="stretch">
            <Text fontSize="xs" fontWeight="bold" color={hasConflict ? 'var(--red)' : 'var(--gold)'} letterSpacing="0.1em">
              {hasConflict ? 'CONFLICT DETECTED' : 'CLOUD SYNC'}
            </Text>

            {hasConflict && (
              <Text fontSize="10px" color="var(--text2)" lineHeight="short">
                Cloud data is newer than local. Please load the latest data to avoid overwriting.
              </Text>
            )}

            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="header-auto-sync" mb="0" fontSize="xs" color="var(--text)" flex="1">
                {t('auto-sync-label', '同期の自動化')}
              </FormLabel>
              <Switch
                id="header-auto-sync"
                isChecked={autoSyncEnabled}
                isDisabled={hasConflict}
                onChange={toggleAutoSync}
                colorScheme="gold"
                size="sm"
                sx={{
                  'span.chakra-switch__track:not([data-checked])': {
                    bg: 'rgba(154,114,36,0.2)',
                  },
                }}
              />
            </FormControl>

            <HStack spacing={2}>
              <Button
                flex={1}
                size="sm"
                variant="outline"
                borderColor={hasConflict ? 'var(--red)' : 'var(--gold-dim)'}
                color={hasConflict ? 'var(--red)' : 'var(--gold)'}
                fontSize="11px"
                onClick={() => handleSave()}
                isLoading={isSaving}
                isDisabled={hasConflict}
                _hover={{ bg: hasConflict ? 'rgba(255,0,0,0.05)' : 'rgba(154,114,36,0.1)' }}
              >
                {t('保存')}
              </Button>
              <Button
                flex={1}
                size="sm"
                variant="solid"
                bg={hasConflict ? 'var(--red)' : 'var(--gold)'}
                color="var(--bg)"
                fontSize="11px"
                as="a"
                href="/cloud"
                _hover={{ bg: hasConflict ? '#d00' : 'var(--gold2)' }}
                onClick={() => {
                  // Standard Link behavior if PWA, but here we just go to page
                }}
              >
                {t('詳細')}
              </Button>
            </HStack>

            {saveStatus === 'failed' && (
              <Text fontSize="10px" color="var(--red)" textAlign="center">
                Sync failed. Check details.
              </Text>
            )}
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  )
}
