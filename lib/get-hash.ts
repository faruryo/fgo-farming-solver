import { origin, region } from '../constants/atlasacademy'

export const getHash = async (): Promise<string> =>
  fetch(`${origin}/info`)
    .then((r) => r.json<{ [region: string]: { hash: string } }>())
    .then((info) => info[region].hash)
