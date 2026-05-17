/**
 * Seeds the browser's localStorage with mock ProgressResponse data so the
 * ProgressReportModal can be tested locally without authentication.
 *
 * Usage: paste the output into your browser's DevTools console while
 *        http://localhost:3000 is open, then navigate to /farming and solve.
 */

const mock = {
  generatedAt: new Date().toISOString(),
  current: { totalAp: 28000 },
  periods: {
    previous: {
      period: 'previous',
      tier: 'large',
      deltaApRaw: 4500,
      deltaApAdjusted: 9500,
      newServantCount: 1,
      newServantOffsetAp: 5000,
      servantGrowth: [
        { servantId: '100100', servantName: 'アルトリア・ペンドラゴン', delta: 9 },
        { servantId: '200200', servantName: 'エミヤ', delta: 6 },
      ],
      targetApIncrease: 0,
      elapsedMinutes: 2880,
      fallback: null,
    },
    week: {
      period: 'week',
      tier: 'medium',
      deltaApRaw: 2200,
      deltaApAdjusted: 2200,
      newServantCount: 0,
      newServantOffsetAp: 0,
      servantGrowth: [
        { servantId: '100100', servantName: 'アルトリア・ペンドラゴン', delta: 3 },
      ],
      targetApIncrease: 0,
      elapsedMinutes: 10080,
      fallback: null,
    },
    month: {
      period: 'month',
      tier: 'small',
      deltaApRaw: 800,
      deltaApAdjusted: 800,
      newServantCount: 0,
      newServantOffsetAp: 0,
      servantGrowth: [],
      targetApIncrease: 1200,
      elapsedMinutes: 43200,
      fallback: null,
    },
  },
}

console.log(
  'Run this in DevTools console:\n',
  `localStorage.setItem('fgo_mock_progress_data', '${JSON.stringify(mock).replace(/'/g, "\\'")}')`
)
