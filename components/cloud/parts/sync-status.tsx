import { Button } from '@/components/ui/button'
import { Stats } from './stats-logic'

interface SyncStatusProps {
  localStats: Stats | null
  cloudStats: Stats | null
  showComparison: boolean
  onToggleComparison: () => void
}

export const SyncStatus = ({ localStats, cloudStats, showComparison, onToggleComparison }: SyncStatusProps) => {
  if (!localStats || !cloudStats) return null

  const isIdentical =
    localStats.ownedCount === cloudStats.ownedCount &&
    localStats.skillTotal === cloudStats.skillTotal &&
    localStats.appendTotal === cloudStats.appendTotal &&
    localStats.gold === cloudStats.gold &&
    localStats.silver === cloudStats.silver &&
    localStats.bronze === cloudStats.bronze

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isIdentical ? (
          <div style={{ fontSize: '12px', color: '#60c890', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Data is identical
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Differences detected
          </div>
        )}
      </div>

      <Button
        className="text-[10px] font-bold tracking-wide h-6 px-3 rounded-full border"
        style={{
          background: showComparison ? 'rgba(154,114,36,0.2)' : 'rgba(154,114,36,0.1)',
          color: 'var(--gold)',
          borderColor: 'rgba(154,114,36,0.2)',
        }}
        onClick={onToggleComparison}
      >
        {showComparison ? 'HIDE DETAILS' : 'CHECK DETAILS'}
      </Button>
    </div>
  )
}
