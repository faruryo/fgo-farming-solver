'use client'

import { useCloudSync } from '../../hooks/use-cloud-sync'

// Headless app-resident mount of the cloud sync engine. The visible
// useCloudSync consumers (nav drawer's CloudRow, /cloud page) only mount
// while shown, so without this the modification tracking, auto-save and
// resume refetch listeners would only run while the drawer is open.
export const CloudSyncEngine = () => {
  useCloudSync()
  return null
}
