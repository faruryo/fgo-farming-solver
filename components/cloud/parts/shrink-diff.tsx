'use client'

import { useTranslation } from 'react-i18next'
import { EnrichedItem } from '../../../lib/get-items'
import { diffKeys, diffPossessions } from '../../../lib/cloud-sync/storage-diff'

type ShrinkDiffProps = {
  // 保存しようとした内容(= この端末の現在の localStorage)
  next: Record<string, string | null | undefined>
  // クラウドが現在持っている内容
  cloud: Record<string, string | null | undefined>
  keys: readonly string[]
  items: EnrichedItem[]
}

// 素材の差分は多いと画面が埋まり、下の選択ボタンまで遠くなる。上位だけ出して
// 残りは件数で示す。
const ITEM_LIMIT = 10

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(140px, 1fr) auto',
  gap: '1px',
  background: 'rgba(154,114,36,0.15)',
  borderRadius: '6px',
  overflow: 'hidden',
  border: '1px solid rgba(154,114,36,0.1)',
  minWidth: '260px',
} as const

const headerCell = {
  background: 'rgba(30,46,74,0.6)',
  padding: '8px 10px',
  fontSize: '10px',
  color: 'var(--text3)',
  fontWeight: 'bold',
} as const

const cellBase = {
  background: 'rgba(30,46,74,0.2)',
  padding: '8px 10px',
  fontSize: '11px',
} as const

/**
 * 保留中の保存で「具体的に何が消えるのか」を出す。件数の要約(ComparisonView や
 * PayloadScale のカード)だけでは 461→0 の中身が分からず、クラウドから読み込むか
 * このまま保存するかを判断できないため、素材ごとの増減とキー単位の内訳を並べる。
 * ガードの判定には一切関与しない表示専用のブロック。
 */
export const ShrinkDiff = ({ next, cloud, keys, items }: ShrinkDiffProps) => {
  const { t } = useTranslation('common')

  const possessionDeltas = diffPossessions(next, cloud)
  const keyDeltas = diffKeys(next, cloud, keys)

  // パース失敗(null)は「差分なし」ではないが数字を作れない。ここでは出さず、
  // 測定不能はキー単位の内訳が unknown(?) として拾う。
  const shown = possessionDeltas?.slice(0, ITEM_LIMIT) ?? []
  const rest = (possessionDeltas?.length ?? 0) - shown.length

  // カタログに無い id(カタログ未ロード・未知のイベント素材)は id をそのまま出す。
  // 名前が出ないからと行ごと落とすと、減る素材を隠すことになる。
  const nameOf = (id: string) =>
    items.find((item) => item.id.toString() === id)?.name ?? id

  // 測定不能(null)を 0 と書くと「消える」と誤読される。? と出す。
  const sizeOf = (size: number | null) => (size == null ? '?' : `${size}`)

  return (
    <div className="flex flex-col gap-3">
      {shown.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium" style={{ color: 'var(--text2)' }}>
            {t('shrink-diff-items-title', '減る素材')}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={gridStyle}>
              <div style={headerCell}>ITEM</div>
              <div style={{ ...headerCell, textAlign: 'right' }}>CLOUD → LOCAL</div>
              {shown.map((delta) => (
                <div key={delta.id} style={{ display: 'contents' }}>
                  <div style={{ ...cellBase, color: 'var(--text2)', wordBreak: 'break-all' }}>
                    {nameOf(delta.id)}
                  </div>
                  <div
                    style={{
                      ...cellBase,
                      color: 'var(--red)',
                      fontWeight: 'bold',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {delta.cloudCount} → {delta.localCount}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {rest > 0 && (
            <div className="mt-1 text-xs" style={{ color: 'var(--text3)' }}>
              {t('shrink-diff-more', 'ほか')} {rest} {t('shrink-diff-more-unit', '件')}
            </div>
          )}
        </div>
      )}

      {/* キーは 19 個あり、開いたままだと下の選択ボタンが押しづらい。既定は畳む。 */}
      <details>
        <summary className="cursor-pointer text-xs" style={{ color: 'var(--text2)' }}>
          {t('shrink-diff-keys-title', 'キー単位の内訳')}
        </summary>
        {/* 上の比較表は「有効なサーヴァント数」、ここは「キー内の項目数」を数える。
            同じ material が 461 と 462 のように食い違って見えるので、何を数えて
            いるのかを明示する。 */}
        <div className="mt-1 text-xs" style={{ color: 'var(--text3)' }}>
          {t(
            'shrink-diff-keys-note',
            '各キーに入っている項目の数です。無効にした育成目標も含むため、上の比較表とは数が異なります。'
          )}
        </div>
        <div className="mt-2" style={{ overflowX: 'auto' }}>
          <div style={gridStyle}>
            <div style={headerCell}>KEY</div>
            <div style={{ ...headerCell, textAlign: 'right' }}>LOCAL / CLOUD</div>
            {keyDeltas.map((delta) => {
              // 消える(missing)・減る(shrunk)だけを目立たせる。same を同じ強さで
              // 出すと、危険な行が 19 行の中に埋もれる。
              const alarming = delta.status === 'missing' || delta.status === 'shrunk'
              const muted = delta.status === 'same'
              return (
                <div key={delta.key} style={{ display: 'contents' }}>
                  <div
                    style={{
                      ...cellBase,
                      color: alarming ? 'var(--red)' : muted ? 'var(--text3)' : 'var(--text2)',
                      fontWeight: alarming ? 'bold' : 'normal',
                      wordBreak: 'break-all',
                    }}
                  >
                    {delta.key}
                    {delta.status === 'missing' &&
                      ` (${t('shrink-diff-status-missing', '消える')})`}
                  </div>
                  <div
                    style={{
                      ...cellBase,
                      color: alarming ? 'var(--red)' : muted ? 'var(--text3)' : 'var(--gold)',
                      fontWeight: alarming ? 'bold' : 'normal',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sizeOf(delta.localSize)} / {sizeOf(delta.cloudSize)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </details>
    </div>
  )
}
