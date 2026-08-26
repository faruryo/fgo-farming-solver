// Short name mapping for items that don't match by simple substring
const NAME_OVERRIDES: Record<string, string> = {
  // 汎用素材
  '証': '英雄の証',
  '骨': '凶骨',
  '牙': '竜の牙',
  '塵': '虚影の塵',
  '鎖': '愚者の鎖',         // 旧: 死の棲む鎖
  '毒針': '万死の毒針',
  '髄液': '魔術髄液',
  '鉄杭': '宵哭きの鉄杭',
  '火薬': '励振火薬',
  '小鐘': '赦免の小鐘',
  '剣': '黄昏の儀式剣',
  '灰': '忘れじの灰',
  '刃': '黒曜鋭刃',
  '残滓': '狂気の残滓',
  '種': '世界樹の種',
  'ﾗﾝﾀﾝ': 'ゴーストランタン',
  '八連': '八連双晶',
  '蛇玉': '蛇の宝玉',
  '羽根': '鳳凰の羽根',
  '頁': '禁断の頁',          // 旧: 禁じられた頁
  '歯車': '無間の歯車',
  '幼角': '戦馬の幼角',
  '脂': '黒獣脂',
  'ﾗﾝﾌﾟ': '封魔のランプ',
  'ｽｶﾗﾍﾞ': '智慧のスカラベ',
  'カケラ': '煌星のカケラ',
  '実': '悠久の実',
  '鬼灯': '鬼炎鬼灯',        // 旧: 禍罪の鬼灯
  '釜': '黄金釜',              // 旧: 誤って夢幻の鱗粉にマッピングされていた
  '月光': '月光核',
  '聖水': '天命の聖水',      // 旧: 神輝聖晶石
  '箱': '遺霊箱',            // 旧: 未知の箱
  'ホム': 'ホムンクルスベビー',
  '蹄鉄': '隕蹄鉄',
  '勲章': '大騎士勲章',
  '勾玉': '枯淡勾玉',
  '結氷': '永遠結氷',
  'ｵｰﾛﾗ': 'オーロラ鋼',
  '矢尻': '禍罪の矢尻',
  '冠': '光銀の冠',
  '霊子': '神脈霊子',
  '糸玉': '虹の糸玉',
  '鱗粉': '夢幻の鱗粉',
  // 新追加素材
  '貝殻': '追憶の貝殻',
  '指輪': '巨人の指輪',
  '鈴': '閑古鈴',
  '皮': '太陽皮',
  '花': '終の花',
  '爪': '混沌の爪',
  '心臓': '蛮神の心臓',
  '逆鱗': '竜の逆鱗',
  '根': '精霊根',
  '涙石': '血の涙石',
  '産毛': '原初の産毛',
  '胆石': '呪獣胆石',
  '神酒': '奇奇神酒',
  '炉心': '暁光炉心',
  '鏡': '九十九鏡',
  '卵': '真理の卵',
  'ｷｭｰﾌﾞ': 'ユニバーサルキューブ',
  'ﾚﾝｽﾞ': '神彩のレンズ',
}

const CLASS_MAP: Record<string, string> = {
  '剣': 'セイバー',
  '弓': 'アーチャー',
  '槍': 'ランサー',
  '騎': 'ライダー',
  '術': 'キャスター',
  '殺': 'アサシン',
  '狂': 'バーサーカー'
}

// ピース/モニュメントはクラス名を使う（セイバーピース）
const CLASS_NAME_SUFFIXES: Record<string, string> = {
  'ピ': 'ピース',
  'モ': 'モニュメント'
}
// 輝石/魔石/秘石は兵種名をそのまま使う（剣の輝石、弓の魔石）
const WEAPON_NAME_SUFFIXES: Record<string, string> = {
  '輝': 'の輝石',
  '魔': 'の魔石',
  '秘': 'の秘石',
}

// Special normalization for class items
export function normalizeItemName(shortName: string): string {
  const override = Reflect.get(NAME_OVERRIDES, shortName) as string | undefined
  if (override) return override

  for (const [s, fullSuffix] of Object.entries(CLASS_NAME_SUFFIXES)) {
    if (shortName.endsWith(s)) {
      const prefix = shortName.slice(0, -s.length)
      const className = Reflect.get(CLASS_MAP, prefix) as string | undefined
      if (className) {
        return className + fullSuffix
      }
    }
  }
  for (const [s, fullSuffix] of Object.entries(WEAPON_NAME_SUFFIXES)) {
    if (shortName.endsWith(s)) {
      const prefix = shortName.slice(0, -s.length)
      const className = Reflect.get(CLASS_MAP, prefix) as string | undefined
      if (className) {
        return prefix + fullSuffix  // 剣 + の輝石 = 剣の輝石
      }
    }
  }

  return shortName
}

const LARGE_CATEGORIES: string[] = ['QP', 'スキル石', '強化素材', 'モニュピ']
const CATEGORIES: Record<string, string>[] = [
  { zero: 'QP' },
  { bronze: '輝石', silver: '魔石', gold: '秘石' },
  { bronze: '銅素材', silver: '銀素材', gold: '金素材' },
  { silver: 'ピース', gold: 'モニュメント' },
]

export function getCategory(priority: number, background: string): { largeCategory: string; category: string } {
  const index = Math.floor(priority / 100)
  const largeCategory = (Reflect.get(LARGE_CATEGORIES, index) as string | undefined) ?? 'イベントアイテム'
  const subMap = Reflect.get(CATEGORIES, index) as Record<string, string> | undefined
  const rawCat = subMap ? (Reflect.get(subMap, background) as string | undefined) : undefined
  const category = rawCat ?? '特殊霊基再臨素材'
  return { largeCategory, category }
}
