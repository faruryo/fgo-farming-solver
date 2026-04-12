import { unmarshall } from '@aws-sdk/util-dynamodb'
import { Result } from '../interfaces/api'
import { getDynamoDb } from './dynamodb'

export const getResult = async (id: string): Promise<Result> => {
  const isDev = process.env.NODE_ENV === 'development'
  const isEdge = process.env.NEXT_RUNTIME === 'experimental-edge'

  if (isDev && !isEdge) {
    const path = await import(/* webpackIgnore: true */ 'path')
    const { readJson } = await import('./read-json')
    const data = await readJson<unknown>(path.default.resolve('mocks', 'result.json'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    return unmarshall(data as any) as Result
  }

  return getDynamoDb({
    region: 'ap-northeast-1',
    tableName: 'fgo-farming-solver-results',
    key: { id },
  }) as Promise<Result>
}
