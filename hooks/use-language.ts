import { useRouter } from 'next/router'
import { useEffect } from 'react'

export const useLanguage = () => {
  const { locale } = useRouter()
}
