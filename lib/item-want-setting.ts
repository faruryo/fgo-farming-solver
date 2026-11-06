/**
 * 品目ごとの「欲しい／いらない」の設定を読み書きする純粋関数。イベントをまたいで共通の1つの保存値に持つ。
 * キーはアイテムの品目なら Atlas の番号の文字列、サーヴァント扱いの品目なら `svt:<番号>`。
 * 値が `false` の品目だけを「いらない」とし、`true` と保存の無い品目は「欲しい」とする。
 */

/** 保存値の形。キー → `true`（欲しい）か `false`（いらない）。 */
export type ItemWantRecord = Record<string, boolean>

/** アイテムの品目のキー（Atlas の番号の文字列）。 */
export const itemWantKey = (atlasId: number): string => String(atlasId)

/** 保存値から「いらない」の品目のキーの集合を読む。`false` 以外の値（`true`・壊れた値）は「欲しい」として扱う。 */
export const readUnwantedKeys = (stored: Readonly<Record<string, unknown>>): Set<string> =>
  new Set(
    Object.entries(stored)
      .filter(([, value]) => value === false)
      .map(([key]) => key),
  )

/**
 * 1つの品目の設定を書いた保存値を返す。「欲しい」は `true`、「いらない」は `false` を書き、キーは消さない
 * （前の版で読んでも同じ意味になるように）。
 */
export const withItemWant = (prev: Readonly<Record<string, unknown>>, key: string, wanted: boolean): ItemWantRecord => ({
  ...Object.fromEntries(Object.entries(prev).filter((e): e is [string, boolean] => typeof e[1] === 'boolean')),
  [key]: wanted,
})
