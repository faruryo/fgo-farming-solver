/**
 * Cloudflare Web Analytics の beacon。
 * token は公開値（ブラウザへ配信される）なので秘密ではない。
 * `NEXT_PUBLIC_CF_BEACON_TOKEN` は NEXT_PUBLIC_ のため **ビルド時にインライン**される
 * （runtime の wrangler [vars] では効かない）。供給は deploy.yml の Build ステップ。
 * 未設定（ローカル `pnpm dev` / 通常ビルド）では undefined → 非描画で計測しない。
 * ホスト変更時は deploy.yml の token を差し替えるだけでよい。
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
