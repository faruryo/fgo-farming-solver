'use client'

import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useTranslation } from 'react-i18next'
import { FaGoogle } from 'react-icons/fa'

export const AuthButton = () => {
  const { data: session } = useSession()
  const { t } = useTranslation('common')
  if (session) {
    return (
      <Button
        onClick={() => {
          signOut().catch((error) => {
            console.error(error)
          })
        }}
        className="h-11 px-6 text-sm"
      >
        <Image
          src={session.user?.image ?? ''}
          width={32}
          height={32}
          className="rounded-full mr-2"
          alt="Your profile"
        />
        {t('サインアウト')}
      </Button>
    )
  }
  return (
    <Button
      onClick={() => {
        signIn('google').catch((error) => console.error(error))
      }}
      className="h-11 px-6 text-sm"
    >
      <FaGoogle />
      {t('サインイン')}
    </Button>
  )
}
