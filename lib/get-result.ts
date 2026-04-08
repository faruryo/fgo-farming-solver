import path from 'path'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { Result } from '../interfaces/api'
import { getDynamoDb } from './dynamodb'
import { readJson } from './read-json'

export const getResult = async (id: string) =>
  process.env.NODE_ENV === 'development'
    ? (readJson(path.resolve('mocks', 'result.json')).then((data) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        unmarshall(data as any),
      ) as Promise<Result>)
    : (getDynamoDb({
        region: 'ap-northeast-1',
        tableName: 'fgo-farming-solver-results',
        key: { id },
      }) as Promise<Result>)
