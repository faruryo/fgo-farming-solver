'use client'

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '../../../components/common/link'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { FaExternalLinkAlt, FaHistory } from 'react-icons/fa'
import { FarmingHistoryChart, HistoryItem } from '../../../components/farming/FarmingHistoryChart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const OBJECTIVE_BADGE: Record<string, string> = {
  ap:   'AP MIN',
  lap:  'LAP MIN',
  both: 'AP+LAP',
}

export default function HistoryPage() {
  const { t } = useTranslation(['farming', 'common', 'dashboard'])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/farming/history')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setHistory(data) })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="c-page">
        <div className="c-page-inner flex flex-col items-center justify-center gap-4 py-20">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: 'var(--gold)' }} />
          <p style={{ color: 'var(--gold-dim)' }}>Loading history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="flex flex-col gap-8">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <div className="c-page-en" style={{ letterSpacing: '0.2em' }}>FARMING HISTORY</div>
              <h1 className="c-page-title flex items-center gap-3">
                <FaHistory style={{ color: 'var(--gold)' }} />
                {t('common:計算履歴')}
              </h1>
            </div>
          </div>

          {history.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <div className="c-card p-6">
                <FarmingHistoryChart history={history} />
              </div>
            </motion.div>
          )}

          <div className="c-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4" style={{ color: 'var(--gold-dim)' }}>{t('日時')}</TableHead>
                  <TableHead className="px-4" style={{ color: 'var(--gold-dim)' }}>{t('目的')}</TableHead>
                  <TableHead className="text-right px-4" style={{ color: 'var(--gold)' }}>合計消費AP</TableHead>
                  <TableHead className="text-right px-4" style={{ color: 'var(--gold)' }}>合計周回数</TableHead>
                  <TableHead className="px-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm py-3 px-4" style={{ color: 'var(--text)' }}>
                      {new Date(item.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px]">
                        {OBJECTIVE_BADGE[item.objective] ?? item.objective}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-3 px-4" style={{ color: 'var(--text2)' }}>
                      {Math.round(item.total_ap).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right py-3 px-4" style={{ color: 'var(--text2)' }}>
                      {Math.round(item.total_lap).toLocaleString()}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <Tooltip>
                        <TooltipTrigger render={<span />}>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            style={{ color: 'var(--gold-dim)' }}
                            render={<Link href={`/farming/results/${item.id}`} />}
                            nativeButton={false}
                          >
                            <FaExternalLinkAlt />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('結果を見る')}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10" style={{ color: 'var(--gold-dim)' }}>
                      {t('履歴がありません')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-center">
            <Link href="/farming" className="c-back-btn">
              {t('計算機に戻る')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
