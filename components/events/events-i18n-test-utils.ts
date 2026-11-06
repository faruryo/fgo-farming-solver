import ja from '../../locales/ja.json'
import { translationMock } from '../i18n-test-utils'

/** テストで react-i18next を置き換え、events の ja の訳と `{{name}}` の差し込みを返す。 */
export const eventsTranslationMock = () => translationMock(ja.events)
