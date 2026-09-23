import { isPreviewAuthHost } from './policy'

export const beginGoogleSignIn = (
  hostname: string,
  actions: { navigate: (url: string) => void; signInGoogle: () => void },
): void => {
  if (isPreviewAuthHost(hostname)) {
    actions.navigate('/api/auth/preview/start')
    return
  }
  actions.signInGoogle()
}
