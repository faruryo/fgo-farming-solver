'use client'

import {
  GridItem,
  Heading,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react'
import { ExternalLinkIcon } from '@chakra-ui/icons'
import { ExternalLink, Link } from '../components/common/link'
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

        <SimpleGrid columns={[1, 1, 2]} spacing={6}>
          <GridItem>
            <Link href="/material" className="c-card" display="block" p={6} _hover={{ textDecoration: 'none' }}>
              <VStack align="start" spacing={2}>
                <div className="c-page-en" style={{ fontSize: '10px', color: 'var(--gold)' }}>MATERIAL</div>
                <Heading size="md" color="var(--navy)">{t('必要素材計算')}</Heading>
                <Text fontSize="sm" color="var(--text2)">{t('material-description')}</Text>
              </VStack>
            </Link>
          </GridItem>

          <GridItem>
            <Link href="/farming" className="c-card" display="block" p={6} _hover={{ textDecoration: 'none' }}>
              <VStack align="start" spacing={2}>
                <div className="c-page-en" style={{ fontSize: '10px', color: 'var(--gold)' }}>SOLVER</div>
                <Heading size="md" color="var(--navy)">{t('周回効率計算')}</Heading>
                <Text fontSize="sm" color="var(--text2)">{t('farming-description')}</Text>
              </VStack>
            </Link>
          </GridItem>

          <GridItem>
            <Link href="/cloud" className="c-card" display="block" p={6} _hover={{ textDecoration: 'none' }}>
              <VStack align="start" spacing={2}>
                <div className="c-page-en" style={{ fontSize: '10px', color: 'var(--gold)' }}>CLOUD</div>
                <Heading size="md" color="var(--navy)">{t('クラウドセーブ')}</Heading>
                <Text fontSize="sm" color="var(--text2)">{t('cloud-description')}</Text>
              </VStack>
            </Link>
          </GridItem>

          <GridItem>
            <ExternalLink
              href={`https://x.com/search?q=${encodeURIComponent('#FGO周回ソルバー')}`}
              className="c-card"
              display="block"
              p={6}
            >
              <VStack align="start" spacing={2}>
                <div className="c-page-en" style={{ fontSize: '10px', color: 'var(--gold)' }}>COMMUNITY</div>
                <Heading size="md" color="var(--navy)">
                  {t('みんなの結果')}
                  <ExternalLinkIcon mx={2} boxSize={3} />
                </Heading>
                <Text fontSize="sm" color="var(--text2)">{t('shared-results-description')}</Text>
              </VStack>
            </ExternalLink>
          </GridItem>
        </SimpleGrid>
      </div>
    </div>
  )
}
