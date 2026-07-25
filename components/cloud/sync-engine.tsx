'use client'

import { useCloudSync } from '../../hooks/use-cloud-sync'
import { DivergenceDialog } from './divergence-dialog'

// Headless app-resident mount of the cloud sync engine. The visible
// useCloudSync consumers (nav drawer's CloudRow, /cloud page) only mount
// while shown, so without this the modification tracking, auto-save and
// resume refetch listeners would only run while the drawer is open.
//
// 分岐(divergent)の選択モーダルもここに置く。常駐している唯一のインスタンスなので、
// どの画面にいてもクラウド取得直後に一度だけ提示できる。
export const CloudSyncEngine = () => {
  const { isDivergent, localStats, cloudStats, cloudData, applyData } = useCloudSync()

  return (
    <DivergenceDialog
      open={isDivergent}
      localStats={localStats}
      cloudStats={cloudStats}
      onRestore={() => {
        if (cloudData) applyData(cloudData.storage, cloudData.metadata)
      }}
    />
  )
}
