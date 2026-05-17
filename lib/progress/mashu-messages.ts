import type { PeriodSummary, ProgressTier } from './types'

// Message categories crossed with tier. Tone reference: appmedia の引用リスト
// (https://appmedia.jp/fategrandorder/75727618) — 敬語 + 先輩呼び。

type MessageBucket = {
  large: string[]
  medium: string[]
  small: string[]
  none: string[]
}

const apProgress: MessageBucket = {
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

const targetIncrease: string[] = [
  '次の目標、しっかり見据えていますね、先輩。素敵です。',
  '挑む山を高くするのは勇気がいります、先輩、応援しています。',
  '前向きな目標設定です、先輩。一緒にがんばりましょう。',
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

const pickRandom = <T,>(list: T[]): T =>
  list[Math.floor(Math.random() * list.length)]

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
  if (summary.newServantCount > 0 && summary.tier !== 'none') {
    return pickRandom(newServantWelcome)
  }
  if (summary.targetApIncrease > 0 && summary.tier === 'none') {
    return pickRandom(targetIncrease)
  }
  if (summary.servantGrowth.length > 0 && summary.tier === 'none') {
    return pickRandom(growth)
  }
  return pickRandom(apProgress[summary.tier as ProgressTier])
}
