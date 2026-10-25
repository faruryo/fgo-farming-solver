import ja from '../../locales/ja.json'

/** テストで react-i18next を置き換え、events の ja の訳と `{{name}}` の差し込みを返す。 */
export const eventsTranslationMock = () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
      const translated: unknown = Reflect.get(ja.events, key)
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
