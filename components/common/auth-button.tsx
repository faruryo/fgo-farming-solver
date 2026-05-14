 
import { Button, Image } from '@chakra-ui/react'
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
        size="lg"
        colorScheme="red"
        leftIcon={
          <Image
            boxSize={8}
            borderRadius="full"
            src={session.user?.image ?? undefined}
            alt="Your profile"
          />
        }
      >
        {t('サインアウト')}
      </Button>
    )
  }
  return (
    <Button
      onClick={() => {
        signIn('google').catch((error) => console.error(error))
      }}
      size="lg"
      colorScheme="red"
      leftIcon={<FaGoogle />}
    >
      {t('サインイン')}
    </Button>
  )
}
