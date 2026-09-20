import type { ClassScoreClassKey } from './types'

export type ClassBoardSquareItem = {
  id: string
  name: string
  amount: number
}

export type ClassBoardSquare = {
  id: number
  posX: number
  posY: number
  icon: string
  name: string
  detail: string
  skillType: string
  flags: string[]
  isStart: boolean
  isLock: boolean
  items: ClassBoardSquareItem[]
}

export type ClassBoardLine = {
  id: number
  prev: number
  next: number
}

export type ClassBoardData = {
  key: ClassScoreClassKey
  id: number
  name: string
  startSquareIds: number[]
  squares: ClassBoardSquare[]
  lines: ClassBoardLine[]
}

export type ClassBoardSquareStatus = 'none' | 'target' | 'unlocked'

export type ClassBoardSelectionState = {
  unlockedSquareIds: number[]
  targetSquareIds: number[]
}
