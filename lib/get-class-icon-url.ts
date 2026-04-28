import { ClassName } from '../interfaces/atlas-academy'
import { staticOrigin, region } from '../constants/atlasacademy'

// Atlas Academy class icon URL format:
// {staticOrigin}/{region}/ClassIcons/class{type}_{classId}.png
// type = rarity tier: rarity≤0→0, 1-2→1, 3-4→2, 5→3
// Source: https://github.com/atlasacademy/apps/blob/master/packages/db/src/Component/ClassIcon.tsx

const CLASS_ID: Partial<Record<ClassName, number>> = {
  saber:         1,
  archer:        2,
  lancer:        3,
  rider:         4,
  caster:        5,
  assassin:      6,
  berserker:     7,
  shielder:      8,
  ruler:         9,
  alterEgo:     10,
  avenger:      11,
  moonCancer:   23,
  foreigner:    25,
  pretender:    28,
  beast:        33,
  beastEresh:   33,
  unBeastOlgaMarie: 40,
}

const rarityToType = (rarity: number): number => {
  if (rarity <= 0) return 0
  if (rarity <= 2) return 1
  if (rarity <= 4) return 2
  return 3
}

export const getClassIconUrl = (className: ClassName, rarity: number): string => {
  const classId = CLASS_ID[className]
  if (!classId) return ''
  const type = rarityToType(rarity)
  return `${staticOrigin}/${region}/ClassIcons/class${type}_${classId}.png`
}
