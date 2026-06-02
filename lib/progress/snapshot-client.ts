import { KEYS } from '../../hooks/use-cloud-sync'

// Persists the user's full localStorage state (including `material`) as a
// progress snapshot after a successful solver run. Fire-and-forget: failures
// are logged but never block the result navigation. Skips when `material` is
// absent so a partial payload can't overwrite a material-containing snapshot.
export const saveProgressSnapshot = async (): Promise<void> => {
  if (typeof window === 'undefined') return
  const storage: Record<string, string> = {}
  for (const key of KEYS) {
    const value = localStorage.getItem(key)
    if (value != null) storage[key] = value
  }
  if (storage.material == null) return
  try {
    await fetch('/api/progress/snapshot', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ storage }),
    })
  } catch (e) {
    console.error('[progress] snapshot save failed:', e)
  }
}
