import React, { useState, useEffect, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { FaChartLine } from 'react-icons/fa'
import { Link } from '../common/link'
import { FarmingHistoryChart, HistoryItem, deriveStockMeta, isStock } from '../farming/FarmingHistoryChart'

export const HistoryGraph: React.FC = () => {
  const { t } = useTranslation(['dashboard', 'common'])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/farming/history')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setHistory(data) })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  // 簡易表示なのでトグルは出さず、最新履歴の種別(ストック込み/通常)だけを表示し回帰の混在を防ぐ。
  const visibleHistory = useMemo(() => {
    const { bothExist, defaultFilter } = deriveStockMeta(history)
    return bothExist ? history.filter(h => isStock(h) === (defaultFilter === 'stock')) : history
  }, [history])

  if (loading) {
    return (
      <div className="u-fgo-card flex justify-center p-8">
        <Loader2 className="animate-spin" style={{ color: 'var(--gold)' }} />
      </div>
    )
  }

  if (history.length < 2) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div className="u-section-header mb-0 flex-1">
          <h2 className="u-section-header-title">
            <FaChartLine className="inline-block mr-2 mb-1" />
            {t('計算履歴の推移')}
          </h2>
          <div className="u-section-header-line" />
        </div>
        <div className="flex gap-2">
          <Link href="/farming/history">
            <Button variant="ghost" className="h-6 px-2 text-[10px]" style={{ color: 'var(--gold-dim)' }}>
              {t('common:すべて見る')}
            </Button>
          </Link>
        </div>
      </div>

      <FarmingHistoryChart history={visibleHistory} />
    </div>
  )
}
