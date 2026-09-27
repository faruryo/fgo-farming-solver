import { useMemo } from 'react'
import { useActiveCampaigns } from '../../hooks/use-active-campaigns'
import { useDrops } from '../../hooks/use-drops'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { useRecentResult } from '../../hooks/use-recent-result'
import { estimateEntry } from '../../lib/bond/entry-estimate'
import { bondIncrement, groupByQuest } from '../../lib/bond/estimate'
import { plannedLapsByQuest } from '../../lib/bond/plan'
import { bondQuestCandidates } from '../../lib/bond/quest-candidates'
import {
  defaultBondQuestId,
  emptyBondTrackerState,
  parseBondTrackerState,
  type BondTrackerEntry,
  type BondTrackerState,
} from '../../lib/bond/state'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'
import { MATERIAL_CLASS_NAMES, type MaterialCatalogServant } from '../../lib/material-catalog'

const DEFAULT_TARGET_LEVEL = 15
const INITIAL_STATE = emptyBondTrackerState()

const useBondActions = (
  setState: (update: (prev: BondTrackerState) => BondTrackerState) => void,
) => ({
  addEntry: (entry: BondTrackerEntry) =>
    setState(prev =>
      prev.entries.some(e => e.servantId === entry.servantId) ? prev : { ...prev, entries: [...prev.entries, entry] },
    ),
  updateEntry: (entry: BondTrackerEntry) =>
    setState(prev => ({ ...prev, entries: prev.entries.map(e => (e.servantId === entry.servantId ? entry : e)) })),
  removeEntry: (servantId: number) =>
    setState(prev => ({ ...prev, entries: prev.entries.filter(e => e.servantId !== servantId) })),
  setTeapot: (teapot: Partial<BondTrackerState['teapot']>) =>
    setState(prev => ({ ...prev, teapot: { ...prev.teapot, ...teapot } })),
})

export const newBondEntry = (servant: MaterialCatalogServant, questId: string): BondTrackerEntry => ({
  servantId: servant.id,
  questId,
  currentLevel: 0,
  remainingToNext: bondIncrement(servant.bondGrowth, 0) ?? 0,
  targetLevel: DEFAULT_TARGET_LEVEL,
  observedPerRun: 0,
  observedTeapotRun: false,
  measuredQuestId: questId,
})

export const useBondTracker = (servants: MaterialCatalogServant[] | undefined) => {
  const drops = useDrops()
  const { activeCampaigns } = useActiveCampaigns(drops.campaigns)
  const [state, setState] = useLocalStorage<BondTrackerState>(STORAGE_KEYS.BOND_TRACKER, INITIAL_STATE, {
    onGet: parseBondTrackerState,
  })
  const { result: recentResult } = useRecentResult()
  const plannedLaps = useMemo(() => plannedLapsByQuest(recentResult), [recentResult])
  const servantsById = useMemo(() => new Map(servants?.map(s => [s.id, s]) ?? []), [servants])
  const questsById = useMemo(() => new Map(drops.quests.map(q => [q.id, q])), [drops.quests])
  const candidatesByClass = useMemo(
    () => new Map(MATERIAL_CLASS_NAMES.map(c => [c as string, bondQuestCandidates(drops.quests, activeCampaigns, c)])),
    [drops.quests, activeCampaigns],
  )
  const teapotStock = state.teapot.enabled ? state.teapot.stock : null
  const cards = useMemo(
    () =>
      state.entries.map(entry => {
        const servant = servantsById.get(entry.servantId)
        const candidates = (servant && candidatesByClass.get(servant.className)) || []
        const estimate = estimateEntry({ entry, growth: servant?.bondGrowth, candidates, questsById, teapotStock })
        return { servant, candidates, estimate }
      }),
    [state.entries, servantsById, candidatesByClass, questsById, teapotStock],
  )
  const summary = useMemo(
    () =>
      groupByQuest(
        cards.map(({ estimate }) => ({
          questId: estimate.entry.questId,
          area: estimate.candidate?.quest.area ?? '',
          effectiveAp: estimate.candidate?.effectiveAp ?? 0,
          runs: estimate.result?.runs.runs ?? null,
        })),
      ),
    [cards],
  )
  const actions = useBondActions(setState)
  const addServant = (servant: MaterialCatalogServant) =>
    actions.addEntry(newBondEntry(servant, defaultBondQuestId(candidatesByClass.get(servant.className) ?? []) ?? ''))
  return { state, cards, summary, questsById, plannedLaps, isLoading: drops.isLoading, addServant, ...actions }
}
