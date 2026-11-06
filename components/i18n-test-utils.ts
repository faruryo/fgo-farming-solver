/**
 * テストで react-i18next を置き換え、`{{name}}` を差し込んだ文字を返す。
 * `messages` を渡すとそのキーの訳を使い、無ければ fallback の文字（無ければキー）を使う。
 */
export const translationMock = (messages?: object) => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
      const translated: unknown = messages ? Reflect.get(messages, key) : undefined
      const untranslated = typeof fallback === 'string' ? fallback : key
      const template = typeof translated === 'string' ? translated : untranslated
      const vars = typeof fallback === 'object' ? fallback : options
      return vars
        ? template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
            const value: unknown = Reflect.get(vars, name)
            return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
          })
        : template
    },
  }),
})
