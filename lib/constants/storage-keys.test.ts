import { describe, it, expect } from 'vitest'
import { STORAGE_KEYS, CLOUD_SYNC_KEYS } from './storage-keys'

describe('storage-keys', () => {
  it('preserves historical posession typo for backwards-compatibility', () => {
    expect(STORAGE_KEYS.POSSESSION).toBe('posession')
  })

  it('contains unique values for all defined keys', () => {
    const values = Object.values(STORAGE_KEYS)
    const uniqueValues = new Set(values)
    expect(uniqueValues.size).toBe(values.length)
  })

  it('strictly preserves the exact 19 cloud sync keys in sequence', () => {
    expect(CLOUD_SYNC_KEYS).toEqual([
      'material',
      'material/result',
      'posession',
      'input',
      'objective',
      'items',
      'quests',
      'excludedQuests',
      'halfDailyAp',
      'dropMergeMethod',
      'farming/results',
      'dropRateKey',
      'dropRateStyle',
      'efficiency/surplusThreshold',
      'efficiency/stockEnabled',
      'efficiency/stockBuffer',
      'masterLevel',
      'todoState',
      'todoSettings',
    ])
  })

  it('matches expected local and metadata storage keys', () => {
    expect(STORAGE_KEYS.PUSH_ENABLED).toBe('fgo_push_enabled')
    expect(STORAGE_KEYS.MOCK_CLOUD).toBe('fgo_mock_cloud_data')
    expect(STORAGE_KEYS.AUTO_SYNC).toBe('fgo_auto_sync_enabled')
    expect(STORAGE_KEYS.LOCAL_METADATA).toBe('fgo_sync_metadata')
    expect(STORAGE_KEYS.TRACKING_MODE).toBe('material/tracking-mode')
    expect(STORAGE_KEYS.TRACKING_SUGGEST_DISMISSED).toBe('material/tracking-suggest-dismissed')
    expect(STORAGE_KEYS.MATERIAL_SELECTION_ADVISOR).toBe('material/selection-advisor-config')
    expect(STORAGE_KEYS.MATERIAL_ADVISOR_TAB).toBe('material/advisor-active-tab')
    expect(STORAGE_KEYS.EVENT_CRAFT_ADVISOR).toBe('material/event-craft-advisor-config')
    expect(STORAGE_KEYS.DASHBOARD_NEAR_GOAL_SORT_MODE).toBe('dashboard.nearGoal.sortMode')
    expect(STORAGE_KEYS.DASHBOARD_RECOMMENDED_QUEST_SORT_MODE).toBe('dashboard.recommendedQuest.sortMode')
    expect(STORAGE_KEYS.EVENTS_GOLDEN_FRUIT).toBe('events/goldenFruit')
    expect(STORAGE_KEYS.QUEST_EFFICIENCY_SHORTAGE_ONLY).toBe('quests/efficiency/shortageOnly')
    expect(STORAGE_KEYS.QUEST_EFFICIENCY_INCLUDE_SKILL_STONES).toBe('quests/efficiency/includeSkillStones')
    expect(STORAGE_KEYS.QUEST_EFFICIENCY_INCLUDE_PIECES).toBe('quests/efficiency/includePieces')
    expect(STORAGE_KEYS.QUEST_EFFICIENCY_DENOMINATOR).toBe('quests/efficiency/denominator')
    expect(STORAGE_KEYS.QUEST_EFFICIENCY_INCLUDE_QP).toBe('quests/efficiency/includeQp')
    expect(STORAGE_KEYS.QUEST_EFFICIENCY_INCLUDE_BOND).toBe('quests/efficiency/includeBond')
    expect(STORAGE_KEYS.QUEST_EFFICIENCY_INCLUDE_EXP).toBe('quests/efficiency/includeExp')
    expect(STORAGE_KEYS.QUEST_EFFICIENCY_SHOW_LOW_KANNI).toBe('quests/efficiency/showLowKanni')
  })
})
