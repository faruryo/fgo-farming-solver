import { motion, AnimatePresence } from 'framer-motion'
import { Stats } from './stats-logic'

interface ComparisonViewProps {
  localStats: Stats
  cloudStats: Stats
  show: boolean
}

export const ComparisonView = ({ localStats, cloudStats, show }: ComparisonViewProps) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 150 }}
          style={{ overflow: 'hidden' }}
        >
          <div style={{ 
            marginTop: '12px', 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr 1fr', 
            gap: '1px', 
            background: 'rgba(154,114,36,0.15)', 
            borderRadius: '6px', 
            overflow: 'hidden', 
            border: '1px solid rgba(154,114,36,0.1)' 
          }}>
            <div style={{ background: 'rgba(30,46,74,0.6)', padding: '8px 10px', fontSize: '10px', color: 'var(--text3)', fontWeight: 'bold' }}>METRIC</div>
            <div style={{ background: 'rgba(30,46,74,0.6)', padding: '8px 10px', fontSize: '10px', color: 'var(--text3)', fontWeight: 'bold', textAlign: 'center' }}>LOCAL</div>
            <div style={{ background: 'rgba(30,46,74,0.6)', padding: '8px 10px', fontSize: '10px', color: 'var(--text3)', fontWeight: 'bold', textAlign: 'center' }}>CLOUD</div>

            <MetricRow label="Servants" local={localStats.ownedCount} cloud={cloudStats.ownedCount} />
            <MetricRow label="Skill Lv" local={localStats.skillTotal} cloud={cloudStats.skillTotal} />
            <MetricRow 
              label="Items (G/S/B)" 
              local={`${localStats.gold}/${localStats.silver}/${localStats.bronze}`} 
              cloud={`${cloudStats.gold}/${cloudStats.silver}/${cloudStats.bronze}`} 
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const MetricRow = ({ label, local, cloud }: { label: string, local: string | number, cloud: string | number }) => {
  const isDifferent = local !== cloud
  
  return (
    <>
      <div style={{ background: 'rgba(30,46,74,0.2)', padding: '8px 10px', fontSize: '11px', color: 'var(--text2)' }}>{label}</div>
      <div style={{ background: 'rgba(30,46,74,0.2)', padding: '8px 10px', fontSize: '12px', color: 'var(--text)', textAlign: 'center' }}>{local}</div>
      <div style={{ 
        background: 'rgba(30,46,74,0.2)', 
        padding: '8px 10px', 
        fontSize: '12px', 
        color: isDifferent ? 'var(--gold)' : 'var(--text)', 
        fontWeight: isDifferent ? 'bold' : 'normal',
        textAlign: 'center' 
      }}>
        {cloud}
      </div>
    </>
  )
}
