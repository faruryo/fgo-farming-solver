'use client'

import {
  GridItem,
  Heading,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Link } from '../components/common/link'
import { useTranslation } from 'react-i18next'

export default function HomePage() {
  const { t } = useTranslation()
  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="c-page-header">
          <div>
            <div className="c-page-en">DASHBOARD</div>
            <h1 className="c-page-title">{t('FGO周回ソルバー')}</h1>
          </div>
        </div>

        <SimpleGrid columns={[1, 1, 3]} spacing={6}>
          <GridItem>
            <Link href="/material" className="c-card" display="block" p={6} _hover={{ textDecoration: 'none' }}>
              <VStack align="start" spacing={2}>
                <div className="c-page-en" style={{ fontSize: '10px', color: 'var(--gold)' }}>MATERIAL</div>
                <Heading size="md" color="var(--navy)">{t('必要素材計算')}</Heading>
                <Text fontSize="sm" color="var(--text2)">{t('material-calculator-description')}</Text>
              </VStack>
            </Link>
          </GridItem>

          <GridItem>
            <Link href="/farming/history" className="c-card" display="block" p={6} _hover={{ textDecoration: 'none' }}>
              <VStack align="start" spacing={2}>
                <div className="c-page-en" style={{ fontSize: '10px', color: 'var(--gold)' }}>HISTORY</div>
                <Heading size="md" color="var(--navy)">{t('計算履歴')}</Heading>
                <Text fontSize="sm" color="var(--text2)">{t('計算履歴・進捗確認')}</Text>
              </VStack>
            </Link>
          </GridItem>

          <GridItem>
            <Link href="/servants" className="c-card" display="block" p={6} _hover={{ textDecoration: 'none' }}>
              <VStack align="start" spacing={2}>
                <div className="c-page-en" style={{ fontSize: '10px', color: 'var(--gold)' }}>SERVANTS</div>
                <Heading size="md" color="var(--navy)">{t('サーヴァント一覧')}</Heading>
                <Text fontSize="sm" color="var(--text2)">{t('servant-list-description')}</Text>
              </VStack>
            </Link>
          </GridItem>
        </SimpleGrid>
      </div>
    </div>
  )
}
