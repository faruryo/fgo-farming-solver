/**
 * update-master-data.yml の最後の段。本番の MASTER_DATA にある値を
 * プレビュー用の MASTER_DATA へ写す(値が違うキーだけ)。
 * 要 env: CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID(DRY_RUN=1 なら不要)。
 */
import { readFileSync } from 'node:fs'
import { kvGet, kvGetIn, kvPutIn } from './kv-rest'
import { syncPreviewMasterData } from './preview-master-data-sync'

async function main(): Promise<number> {
  return syncPreviewMasterData({
    toml: readFileSync('wrangler.toml', 'utf8'),
    getProduction: kvGet,
    getPreview: kvGetIn,
    putPreview: kvPutIn,
  })
}

main()
  .then(code => process.exit(code))
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
