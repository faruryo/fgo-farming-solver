import { Metadata } from 'next'
import { Providers } from './providers'
import { Layout } from '../components/common/layout'

export const metadata: Metadata = {
  title: 'FGO周回ソルバー',
  description: 'FGOの周回効率を計算するツール',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        <Providers>
          <Layout>
            {children}
          </Layout>
        </Providers>
      </body>
    </html>
  )
}
