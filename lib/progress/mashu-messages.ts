import type { PeriodSummary, ProgressTier } from './types'
import { classifyTier } from './tier'

// Message categories crossed with tier. Tone reference: appmedia の引用リスト
// (https://appmedia.jp/fategrandorder/75727618) — 敬語 + 先輩呼び。

type MessageBucket = {
  legendary: string[]
  large: string[]
  medium: string[]
  small: string[]
  none: string[]
}

const apProgress: MessageBucket = {
  legendary: [
    '先輩……これは伝説級の戦果です……！ 言葉になりません。',
    'まさかここまでとは……ボックスもレイドも、先輩の伝説的な全力を見せつけられました。',
    '歴代最高クラスの進捗です、先輩。カルデアの誇りです。',
    'この結果は語り継ぐべきです、先輩。本当にお疲れさまでした、そして、おめでとうございます。',
  ],
  large: [
    '先輩、すごい消費 AP の削減です……！ 圧倒されてしまいました。',
    'これだけの周回成果、わたしも誇らしいです、先輩。',
    '見事な進捗です、先輩。今回の戦果、しっかり記録しました。',
    '想定以上の前進です。先輩、お見事でした。',
  ],
  medium: [
    '着実に進んでいますね、先輩。とても良いペースです。',
    '無理のない速度で、しっかり成果が出ています。先輩らしいです。',
    'コツコツ積み上げる姿勢、わたしも見習いたいです、先輩。',
  ],
  small: [
    '少しずつでも前進、ですね。先輩、お疲れさまです。',
    'わずかでも変化があるのは、立派な進歩です、先輩。',
    '焦らず、一歩ずつで大丈夫ですよ、先輩。',
  ],
  none: [
    '無理は禁物です、先輩。今日はゆっくり休んでくださいね。',
    '進めなかった日にも、意味があると思います、先輩。',
    '今日はここまで、で大丈夫です。データはちゃんと残しました。',
  ],
}

const newServantWelcome: string[] = [
  '新しい仲間が増えたんですね、先輩！ おめでとうございます。',
  '新規入手のサーヴァント、わたしも嬉しいです、先輩。',
  '新しい絆ですね、先輩。一緒に育てていきましょう。',
]

const growth: string[] = [
  'スキル強化、しっかり進めましたね、先輩。',
  'サーヴァントの成長、確かに見届けました、先輩。',
  '育成、着実に前進しています、先輩。素晴らしいです。',
]

const fallbackFirstTime: string[] = [
  '初めての記録、ありがとうございます、先輩。これから一緒に追っていきますね。',
  '登録完了です、先輩。ここを起点に、進捗を見ていきましょう。',
  'はじめまして、先輩。これから進捗を一緒に追えるのが楽しみです。',
]

const fallbackNoSnapshot: string[] = [
  'この期間のデータはまだないようです、先輩。記録が貯まるとここに表示されますね。',
  '比較できる過去データがまだないですが、お気になさらず、先輩。',
  'これからのデータが、ここに少しずつ積み上がっていきます、先輩。',
]

const fallbackZero: string[] = [
  '今日は数値の変化はなかったみたいですが、登録お疲れさまです、先輩。',
  '進捗ゼロでも、続けることが何より大切です、先輩。',
  '今日もデータ更新、ありがとうございます、先輩。',
]

// 労力修飾(design.md D3): 方向性(前進周回)は控えめでも、労力周回(獲得の周回換算、
// 余剰・備蓄含む)が大きい月に活動量・備蓄を労うトーン。備蓄王(前進0でも大量獲得)の
// ような「効率は低くても動いた月」を、tier とは独立に認知するためのメッセージ群。
const effortPraise: string[] = [
  '目に見える前進は控えめでも、たくさん動いた月でしたね、先輩。備蓄、しっかり積み上がっています。',
  '効率よりも量、という月だったようです、先輩。その活動量はきっと後で効いてきます。',
  '今回は備蓄に回った分が多かったようですね、先輩。それも立派な活動量です。',
]

const pickRandom = <T,>(list: T[]): T =>
  list[Math.floor(Math.random() * list.length)]

// 「労力が large 相当以上」= classifyTier(値, 経過分)が large/legendary。
const isHighEffort = (effortLaps: number, elapsedMinutes: number): boolean => {
  const effortTier = classifyTier(effortLaps, elapsedMinutes)
  return effortTier === 'large' || effortTier === 'legendary'
}

export const selectMashuMessage = (summary: PeriodSummary | null): string => {
  if (summary == null) return pickRandom(fallbackNoSnapshot)

  switch (summary.fallback) {
    case 'first_time':
      return pickRandom(fallbackFirstTime)
    case 'no_snapshot_for_period':
      return pickRandom(fallbackNoSnapshot)
    case 'zero_progress':
      return pickRandom(fallbackZero)
  }

  // Layered selection: prefer the most "notable" event of the period.
  // 新規入手・育成は tier(=方向性/労力の周回換算)とは独立した「達成」なので、
  // tier が none(周回の純増がゼロ/マイナス)でも必ず労う。素材を育成に使った日に
  // 「お疲れさま(休んで)」が出る不整合を避ける。
  if (summary.newServantCount > 0) {
    return pickRandom(newServantWelcome)
  }
  if (summary.growthTotal > 0) {
    return pickRandom(growth)
  }

  // 2軸修飾: 方向性(前進周回、tier とは別に summary.forwardLaps から再判定)が
  // medium 以下で、労力周回が large 相当以上なら、労いトーンを優先する。
  // summary.tier は前進ゼロ時に労力周回で補完済み(D4)のため、ここでは補完前の
  // 「方向性そのもの」を forwardLaps から独立に判定する必要がある。
  const directionTier = classifyTier(summary.forwardLaps ?? 0, summary.elapsedMinutes)
  const isDirectionLowOrMid =
    directionTier === 'none' || directionTier === 'small' || directionTier === 'medium'
  if (isDirectionLowOrMid && isHighEffort(summary.effortLaps ?? 0, summary.elapsedMinutes)) {
    return pickRandom(effortPraise)
  }

  return pickRandom(apProgress[summary.tier as ProgressTier])
}
