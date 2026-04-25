declare module 'javascript-lp-solver' {
  export interface Model {
    optimize: string
    opType: string
    constraints: Record<string, { min?: number; max?: number; equal?: number }>
    variables: Record<string, Record<string, number>>
    ints?: Record<string, number>
    binaries?: Record<string, number>
  }

  export interface Result {
    feasible: boolean
    result: number
    bounded: boolean
    [key: string]: any
  }

  export function Solve(model: Model): Result
}
