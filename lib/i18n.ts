import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ja from '../locales/ja.json'
import en from '../locales/en.json'

const resources = {
  ja,
  en,
}

i18n.use(initReactI18next).init({
  resources,
  lng: 'ja',
  fallbackLng: 'ja',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
