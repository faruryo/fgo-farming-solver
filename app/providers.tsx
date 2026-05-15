'use client'

import EmotionRegistry from '../lib/emotion-registry'
import { ChakraProvider } from '@chakra-ui/react'
import { SessionProvider } from 'next-auth/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { theme } from '../theme'
import '../lib/i18n'


export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <EmotionRegistry>
      <SessionProvider>
        <ChakraProvider theme={theme}>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </ChakraProvider>
      </SessionProvider>
    </EmotionRegistry>
  )
}
