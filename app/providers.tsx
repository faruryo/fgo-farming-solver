'use client'

import { useEffect } from 'react'
import { SessionProvider } from 'next-auth/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { CloudSyncEngine } from '@/components/cloud/sync-engine'
import '../lib/i18n'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }
  }, [])

  return (
    <SessionProvider>
      <TooltipProvider>
        {children}
        <Toaster />
        <CloudSyncEngine />
      </TooltipProvider>
    </SessionProvider>
  )
}
