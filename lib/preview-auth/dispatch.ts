import {
  HANDOFF_PREFIX,
  isHandoffBranchEnabled,
  type EnvSource,
} from './policy'

const reject = (): Response => new Response(null, { status: 400 })

export const dispatchAuthGet = async (
  request: Request,
  env: EnvSource,
  deps: {
    nextAuthGet: (request: Request) => Promise<Response>
    handleHandoff: (request: Request) => Promise<Response>
  },
): Promise<Response> => {
  if (!isHandoffBranchEnabled(env)) return deps.nextAuthGet(request)
  const states = new URL(request.url).searchParams.getAll('state')
  const handoffStates = states.filter((state) =>
    state.startsWith(HANDOFF_PREFIX),
  )
  if (handoffStates.length === 0) return deps.nextAuthGet(request)
  if (states.length !== 1) return reject()
  return deps.handleHandoff(request)
}
