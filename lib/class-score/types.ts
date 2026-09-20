export const CLASS_SCORE_CLASS_KEYS = [
  'saber',
  'archer',
  'lancer',
  'rider',
  'caster',
  'assassin',
  'berserker',
  'extra1',
  'extra2',
] as const

export type ClassScoreClassKey = (typeof CLASS_SCORE_CLASS_KEYS)[number]

export type ClassScoreStatus = 'none' | 'target' | 'completed'

export type ClassBoardDetailState = {
  unlockedSquareIds: number[]
  targetSquareIds: number[]
}

export type ClassScoreState = {
  classes: Partial<Record<ClassScoreClassKey, ClassScoreStatus>>
  boards?: Partial<Record<ClassScoreClassKey, ClassBoardDetailState>>
}

export type ClassScoreItemRequirement = {
  id: string // Atlas Item ID
  name: string
  amount: number
}

export type ClassScoreBoardDefinition = {
  key: ClassScoreClassKey
  name: string
  enName: string
  qp: number
  materials: ClassScoreItemRequirement[]
  pieces: ClassScoreItemRequirement[]
  monuments: ClassScoreItemRequirement[]
  specialItems: ClassScoreItemRequirement[]
}

export const DEFAULT_CLASS_SCORE_STATE: ClassScoreState = {
  classes: {
    saber: 'none',
    archer: 'none',
    lancer: 'none',
    rider: 'none',
    caster: 'none',
    assassin: 'none',
    berserker: 'none',
    extra1: 'none',
    extra2: 'none',
  },
}
