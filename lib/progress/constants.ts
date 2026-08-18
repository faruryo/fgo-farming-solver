// QP(atlasId '1')は所持が桁違いで周回換算・スループット進捗を破綻させるため除外する。
export const EXCLUDED_ATLAS_IDS = new Set<string>(['1'])
