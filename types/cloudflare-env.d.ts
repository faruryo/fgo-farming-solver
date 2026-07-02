export interface CloudflareEnv {
  CLOUD_SAVE: KVNamespace
  MASTER_DATA: KVNamespace
  DB: D1Database
  VAPID_PUBLIC_KEY: string
}

