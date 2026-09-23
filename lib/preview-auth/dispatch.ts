import { HANDOFF_PREFIX, isHandoffBranchEnabled, shouldHandlePreviewHandoff, type EnvSource } from './policy'

const reject = (): Response => new Response(null, { status: 400 })

export const requestNeedsHandoff = (url: string): boolean =>
  new URL(url).searchParams.getAll('state').some((state) => state.startsWith(HANDOFF_PREFIX))

export const dispatchAuthGet = async (
  request: Request,
  env: EnvSource,
  deps: {
    nextAuthGet: (request: Request) => Promise<Response>
    handleHandoff: (request: Request) => Promise<Response>
  },
): Promise<Response> => {
  const states = new URL(request.url).searchParams.getAll('state')
  if (states.length === 1 && shouldHandlePreviewHandoff(states[0] ?? null, env)) {
    return deps.handleHandoff(request)
  }
  if (isHandoffBranchEnabled(env) && requestNeedsHandoff(request.url)) return reject()
  return deps.nextAuthGet(request)
}
