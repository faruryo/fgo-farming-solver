export const MAIN_CLASSES = ['saber', 'archer', 'lancer', 'rider', 'caster', 'assassin', 'berserker'] as const
export const EXTRA_CLASSES = ['shielder', 'ruler', 'avenger', 'alterEgo', 'moonCancer', 'foreigner', 'pretender', 'beast'] as const

export const CLASS_LIST = [
  { id: 'all',        label: '全て',         abbr: 'ALL', color: '#9a7224' },
  { id: 'saber',      label: 'セイバー',     abbr: 'SAB', color: '#4878c0' },
  { id: 'archer',     label: 'アーチャー',   abbr: 'ARC', color: '#c04848' },
  { id: 'lancer',     label: 'ランサー',     abbr: 'LAN', color: '#2856a8' },
  { id: 'rider',      label: 'ライダー',     abbr: 'RID', color: '#703898' },
  { id: 'caster',     label: 'キャスター',   abbr: 'CAS', color: '#207868' },
  { id: 'assassin',   label: 'アサシン',     abbr: 'ASN', color: '#483478' },
  { id: 'berserker',  label: 'バーサーカー', abbr: 'BER', color: '#982020' },
  { id: 'shielder',   label: 'シールダー',   abbr: 'SHI', color: '#606878' },
  { id: 'ruler',      label: 'ルーラー',     abbr: 'RUL', color: '#886020' },
  { id: 'avenger',    label: 'アヴェンジャー', abbr: 'AVG', color: '#403468' },
  { id: 'alterEgo',   label: 'アルターエゴ', abbr: 'ALT', color: '#904070' },
  { id: 'moonCancer', label: 'ムーンキャンサー', abbr: 'MNC', color: '#a04880' },
  { id: 'foreigner',  label: 'フォーリナー', abbr: 'FOR', color: '#303080' },
  { id: 'pretender',  label: 'プリテンダー', abbr: 'PRE', color: '#6070a0' },
  { id: 'beast',      label: 'ビースト',     abbr: 'BST', color: '#c05020' },
] as const

export type ClassId = (typeof CLASS_LIST)[number]['id']

export const getClassInfo = (className: string) => {
  const found = CLASS_LIST.find(c => c.id === className)
  if (found) return found
  // Handle variations or fallback
  if (className.startsWith('beast')) return CLASS_LIST[CLASS_LIST.length - 1] // Last is Beast
  return CLASS_LIST[0] // Fallback to ALL
}
