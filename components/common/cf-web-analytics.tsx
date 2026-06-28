/**
 * Cloudflare Web Analytics の beacon。
 * token は公開値（ブラウザへ配信される）なので秘密ではない。
 * `NEXT_PUBLIC_CF_BEACON_TOKEN`（wrangler.toml [vars]）が空のときは描画しない
 * → ローカル開発や token 未設定時は計測しない。ホスト変更時は token 差し替えのみでよい。
 */
export const CfWebAnalytics = () => {
  const token = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN
  if (!token) return null

  return (
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token })}
    />
  )
}
