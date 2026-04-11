export const readJson = async <T>(path: string) => {
  if (process.env.NEXT_RUNTIME === 'edge') {
    throw new Error('readJson is not supported in edge runtime')
  }
  const fs = await import(/* webpackIgnore: true */ 'fs/promises')
  return fs.default.readFile(path, 'utf-8').then((file: string) => JSON.parse(file) as T)
}
