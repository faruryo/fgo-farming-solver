/**
 * Central registry for localStorage keys used throughout the application.
 *
 * NOTE: Historical typos (such as `posession`) are intentionally preserved
 * in their string values to ensure backward-compatibility with users' existing
 * local storage data and Cloudflare D1 cloud-sync snapshots.
 */
export const STORAGE_KEYS = {
  // Sync-targeted core user state
  MATERIAL: 'material',
  MATERIAL_RESULT: 'material/result',
  POSSESSION: 'posession',
  INPUT: 'input',
  OBJECTIVE: 'objective',
  ITEMS: 'items',
  QUESTS: 'quests',
  EXCLUDED_QUESTS: 'excludedQuests',
  HALF_DAILY_AP: 'halfDailyAp',
  DROP_MERGE_METHOD: 'dropMergeMethod',
  FARMING_RESULTS: 'farming/results',
  DROP_RATE_KEY: 'dropRateKey',
  DROP_RATE_STYLE: 'dropRateStyle',
  SURPLUS_THRESHOLD: 'efficiency/surplusThreshold',
  STOCK_ENABLED: 'efficiency/stockEnabled',
  STOCK_BUFFER: 'efficiency/stockBuffer',
  FARMING_PURPOSE: 'efficiency/farmingPurpose',
  MASTER_LEVEL: 'masterLevel',
  TODO_STATE: 'todoState',
  TODO_SETTINGS: 'todoSettings',

  // Local/UI-only state and metadata
  TRACKING_MODE: 'material/tracking-mode',
  TRACKING_SUGGEST_DISMISSED: 'material/tracking-suggest-dismissed',
  MOCK_CLOUD: 'fgo_mock_cloud_data',
  AUTO_SYNC: 'fgo_auto_sync_enabled',
  LOCAL_METADATA: 'fgo_sync_metadata',
  PUSH_ENABLED: 'fgo_push_enabled',
  MATERIAL_SELECTION_ADVISOR: 'material/selection-advisor-config',
  MATERIAL_ADVISOR_TAB: 'material/advisor-active-tab',
  EVENT_CRAFT_ADVISOR: 'material/event-craft-advisor-config',
  DASHBOARD_NEAR_GOAL_SORT_MODE: 'dashboard.nearGoal.sortMode',
  DASHBOARD_RECOMMENDED_QUEST_SORT_MODE: 'dashboard.recommendedQuest.sortMode',
  DASHBOARD_HIDE_COMPLETED_EVENTS: 'dashboard.eventSection.hideCompleted',
  EVENTS_GOLDEN_FRUIT: 'events/goldenFruit',

  // Quest efficiency filters
  QUEST_EFFICIENCY_SHORTAGE_ONLY: 'quests/efficiency/shortageOnly',
  QUEST_EFFICIENCY_INCLUDE_SKILL_STONES: 'quests/efficiency/includeSkillStones',
  QUEST_EFFICIENCY_INCLUDE_PIECES: 'quests/efficiency/includePieces',
  QUEST_EFFICIENCY_DENOMINATOR: 'quests/efficiency/denominator',
  QUEST_EFFICIENCY_INCLUDE_QP: 'quests/efficiency/includeQp',
  QUEST_EFFICIENCY_INCLUDE_BOND: 'quests/efficiency/includeBond',
  QUEST_EFFICIENCY_INCLUDE_EXP: 'quests/efficiency/includeExp',
  QUEST_EFFICIENCY_SHOW_LOW_KANNI: 'quests/efficiency/showLowKanni',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/**
 * Keys synchronized to the cloud.
 */
export const CLOUD_SYNC_KEYS = [
  STORAGE_KEYS.MATERIAL,
  STORAGE_KEYS.MATERIAL_RESULT,
  STORAGE_KEYS.POSSESSION,
  STORAGE_KEYS.INPUT,
  STORAGE_KEYS.OBJECTIVE,
  STORAGE_KEYS.ITEMS,
  STORAGE_KEYS.QUESTS,
  STORAGE_KEYS.EXCLUDED_QUESTS,
  STORAGE_KEYS.HALF_DAILY_AP,
  STORAGE_KEYS.DROP_MERGE_METHOD,
  STORAGE_KEYS.FARMING_RESULTS,
  STORAGE_KEYS.DROP_RATE_KEY,
  STORAGE_KEYS.DROP_RATE_STYLE,
  STORAGE_KEYS.SURPLUS_THRESHOLD,
  STORAGE_KEYS.STOCK_ENABLED,
  STORAGE_KEYS.STOCK_BUFFER,
  STORAGE_KEYS.FARMING_PURPOSE,
  STORAGE_KEYS.MASTER_LEVEL,
  STORAGE_KEYS.TODO_STATE,
  STORAGE_KEYS.TODO_SETTINGS,
] as const

export type CloudSyncKey = (typeof CLOUD_SYNC_KEYS)[number]

const CLOUD_SYNC_KEY_SET = new Set<string>(CLOUD_SYNC_KEYS)

export const isCloudSyncKey = (key: string): key is CloudSyncKey =>
  CLOUD_SYNC_KEY_SET.has(key)
