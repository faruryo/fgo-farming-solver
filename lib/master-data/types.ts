import type { IdRegistry } from './stable-ids'

export interface Item {
  category: string
  name: string
  id: string
  largeCategory?: string
  shortName?: string
  icon?: string
  /** Atlas Academy のアイテムID。育成計算機(material/result・所持数)と同じID空間で連動するために保持。 */
  atlasId?: number
}

export interface Enemy {
  name: string
  className: string
  hp: number
  attribute: string
}

export interface Wave {
  enemies: Enemy[]
}

export interface Quest {
  area: string
  ap: number
  name: string
  id: string
  section: string
  aaQuestId?: number
  waveCount?: number
  /** 新規ID割当日（ISO 8601 日付）。id_registry から射影。NEW バッジ判定に使う。 */
  addedAt?: string
}

export interface DropRate {
  quest_id: string
  item_id: string
  drop_rate: number
}

export type CampaignCalcType = 'multiplication' | 'fixedValue' | 'addition' | 'none'

export interface Campaign {
  id: number
  calcType: CampaignCalcType
  value: number
  validFrom: number
  validTo: number
  questIds: string[]
}

export interface MasterData {
  items: Item[]
  quests: Quest[]
  drop_rates: DropRate[]
  campaigns: Campaign[]
  /**
   * 短縮IDの世代間安定化のための append-only な採番レジストリ。
   * 更新ワーカーが前回公開ペイロードから引き継ぎ、同一対象に同一IDを割り当て続ける。
   * 既存消費者（lib/get-drops.ts 等）には不可視（後方互換）。
   */
  id_registry?: IdRegistry
}

// ── Event / Lottery planner types ───────────────────────────────────

/**
 * イベント通貨アイテム。Atlas Academy のアイテム ID を使用（atlasId 空間）。
 */
export interface EventCurrency {
  /** Atlas Academy item id */
  id: number
  name: string
  icon: string
}

/**
 * 1箱分（1 boxIndex 分）のロトボックス情報。
 * 11箱ロトなら boxIndex 0 〜 10 に相当する。
 */
export interface EventLotteryBox {
  /** 箱ラウンドインデックス（0 始まり）。 */
  boxIndex: number
  /** 1箱を開けるのに必要なイベント通貨の合計数。 */
  costPerBox: number
  /** 箱確定報酬の集計（素材。レア報酬は rareRewards に分離）。 */
  contents: { itemId: number; num: number; name: string; icon?: string }[]
  /**
   * レアボックス報酬。素材なら充当計算に含める。
   * サーヴァント/礼装/コマンドコード（objType で判定）は別バッジ表示する。
   */
  rareRewards: { itemId: number; num: number; objType: string; name: string; icon?: string }[]
}

/**
 * 交換所の1エントリー（purchaseType='item' かつ payType='eventItem' のみ）。
 */
export interface EventShopItem {
  /** 獲得アイテムの Atlas Academy item id。 */
  itemId: number
  /** 1回の購入で得られる個数（Atlas setNum）。 */
  qty: number
  /** 対価となるイベント通貨の Atlas Academy item id。 */
  costItemId: number
  /** 1回の購入に必要な通貨量。 */
  costAmount: number
  /** 購入上限（在庫数）。 */
  limitNum: number
  /** アイテム名（UI 表示用。旧 KV データとの後方互換のためオプショナル）。 */
  name?: string
  /** アイテムアイコン URL（UI 表示用。オプショナル）。 */
  icon?: string
}

/**
 * 周回ノード（farmable quest）とそのドロップ情報。
 */
export interface EventFarmingNode {
  /** Atlas Academy quest id。 */
  questId: number
  name: string
  /** AP 消費。 */
  ap: number
  /**
   * 1周あたり期待ドロップ数。
   * Atlas ドロップデータ（dropCount / runs * num）から算出。
   * 新規イベント序盤は空配列（手入力フォールバック用）。
   */
  drops: { itemId: number; perRun: number; name?: string; icon?: string }[]
}

/**
 * コンパクト化されたイベントデータ（KV `event_data_json` の1エントリー）。
 * ロト（ボックス）型イベントのみを対象とする。
 */
export interface EventPlannerEvent {
  /** Atlas Academy event id。 */
  id: number
  name: string
  /** Atlas Academy event type（"eventQuest" 等）。 */
  type: string
  /** 開催開始 Unix timestamp（秒）。 */
  startedAt: number
  /** 開催終了 Unix timestamp（秒）。 */
  endedAt: number
  /** ロトで使用するイベント通貨。 */
  currency: EventCurrency
  /**
   * 最終箱が無限ループするか（Atlas lottery.limited === false）。
   * true のとき目標箱数は箱種類数（lotteries.length）を超えて指定でき、
   * 超過分は最終箱の cost / contents の繰り返しとして計算する。
   */
  unlimitedBoxes: boolean
  /**
   * ロトボックスの箱ラウンドごとの情報（boxIndex 昇順）。
   * 11箱ロトなら 11 要素。
   */
  lotteries: EventLotteryBox[]
  /** 交換所の素材エントリー（purchaseType='item' かつ payType='eventItem' のみ）。 */
  shop: EventShopItem[]
  /** イベント周回ノード。 */
  farmingNodes: EventFarmingNode[]
}

/**
 * KV `event_data_json` のルート構造。
 */
export interface EventData {
  /** ロト型イベントの一覧（開催中＋直近終了を含む）。 */
  events: EventPlannerEvent[]
  /** この KV が最後に更新された Unix timestamp（秒）。 */
  updatedAt: number
}

export interface DashboardCampaignInfo {
  target: string
  calcType: string
  value: number
  targetIds?: number[]
}

export interface DashboardEvent {
  id: number
  name: string
  /**
   * バナー画像 URL。`type=questCampaign` などのバナーレスイベントでは `null`。
   * EventSection はバナーあり、CampaignSection はバナーレスをそれぞれフィルタする。
   */
  banner: string | null
  startedAt: number
  endedAt: number
  shopFinishedAt: number
  type: string
  drops: { id: number; name: string; icon: string }[]
  /**
   * Atlas Academy `event.campaigns` の主要フィールドのみを保持。
   * バナーレスキャンペーンを CampaignSection で分類するために使う。
   */
  campaigns?: DashboardCampaignInfo[]
  /** Atlas Academy `event.campaignQuests` の件数 (`isExcepted=true` を含む生件数)。 */
  campaignQuestsCount?: number
}

export interface DashboardGacha {
  id: number
  name: string
  banner: string
  openedAt: number
  closedAt: number
  pickupServants: { id: number; name: string; rarity: number; face: string }[]
}

export interface RecentServant {
  id: number
  name: string
  rarity: number
  face: string
  releasedAt: number
  collectionNo: number
}

export interface PodFreePeriod {
  /** Source event id (Atlas Academy event.id), useful for deduplication & debugging. */
  id: number
  name: string
  startedAt: number
  endedAt: number
  /** Target quests projected into our app-internal short quest ID space. */
  questIds: string[]
}

export interface DashboardMeta {
  events: DashboardEvent[]
  gachas: DashboardGacha[]
  recentServants: RecentServant[]
  updatedAt: number
  /**
   * "ストーム・ポッド消費なし" キャンペーン期間。Atlas Academy 上で event name に
   * 「ストーム・ポッド消費なし」を含む `questCampaign` から抽出する。
   * 旧データとの後方互換のためオプショナル。
   */
  podFreePeriods?: PodFreePeriod[]
}
