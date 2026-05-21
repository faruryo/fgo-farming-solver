/**
 * 冠位戴冠戦・冠位研鑽戦・オーディール・コール のフリークエストは
 * 通常の AP ではなく「ストーム・ポッド」を消費する。
 *
 * Atlas Academy のクエストデータには「ストーム・ポッド消費フラグ」が
 * 公開されていないため、quest.area の表記で間接判定する。
 */
const POD_AREA_KEYWORDS = ['冠位戴冠戦', '冠位研鑽戦', 'オーディール・コール']

export const questConsumesPod = (area: string | null | undefined): boolean => {
  if (!area) return false
  return POD_AREA_KEYWORDS.some(kw => area.includes(kw))
}
