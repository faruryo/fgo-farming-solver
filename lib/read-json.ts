export const readJson = async <T>(path: string) => {
  if (process.env.NEXT_RUNTIME === 'experimental-edge') {
    throw new Error('readJson is not supported in experimental-edge runtime')
  }
  const fsModule = await import(/* webpackIgnore: true */ 'fs/promises')
  const fs = fsModule.default || fsModule
  return fs.readFile(path, 'utf-8').then((file: string) => JSON.parse(file) as T)
}
