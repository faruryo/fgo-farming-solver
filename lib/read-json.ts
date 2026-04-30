/**
 * Read and parse a JSON file from the local filesystem.
 *
 * This is a thin wrapper around fs.readFile.
 * It will throw if called in a true edge runtime (no fs access).
 * Callers should catch errors or use data-source.ts helpers instead.
 */
export const readJson = async <T>(path: string): Promise<T> => {
  const fsModule = await import(/* webpackIgnore: true */ 'fs/promises')
  const fs = fsModule.default || fsModule
  const text = await fs.readFile(path, 'utf-8')
  return JSON.parse(text) as T
}
