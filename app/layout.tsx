import { Metadata } from 'next'
import { Cinzel } from 'next/font/google'
import { Providers } from './providers'
import { Layout } from '../components/common/layout'
import { CfWebAnalytics } from '../components/common/cf-web-analytics'
import './globals.css'

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-cinzel',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'FGO周回ソルバー',
  description: 'FGOの周回効率を計算するツール',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className={cinzel.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <Layout>
            {children}
          </Layout>
        </Providers>
        <CfWebAnalytics />
      </body>
    </html>
  )
}
