'use client'

import {
  Card,
  CardBody,
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
    <VStack spacing={10} alignItems="stretch">
      <SimpleGrid columns={[1, 1, 2]} spacing={10}>
        <GridItem>
          <Card>
            <Link href="/farming" variant="unstyled" _hover={{ textDecoration: 'none' }}>
              <CardBody>
                <Heading size="lg">{t('周回効率計算')}</Heading>
                <Text>{t('farming-description')}</Text>
              </CardBody>
            </Link>
          </Card>
        </GridItem>

        <GridItem>
          <Card>
            <Link href="/material" variant="unstyled" _hover={{ textDecoration: 'none' }}>
              <CardBody>
                <Heading size="lg">{t('必要素材計算')}</Heading>
                <Text>{t('material-description')}</Text>
              </CardBody>
            </Link>
          </Card>
        </GridItem>

        <GridItem>
          <Card>
            <Link href="/cloud" variant="unstyled" _hover={{ textDecoration: 'none' }}>
              <CardBody>
                <Heading size="lg">{t('クラウドセーブ')}</Heading>
                <Text>{t('cloud-description')}</Text>
              </CardBody>
            </Link>
          </Card>
        </GridItem>

        <GridItem>
          <Card>
            <ExternalLink
              href={`https://twitter.com/search?q=${encodeURIComponent(
                '#FGO周回ソルバー'
              )}`}
              variant="unstyled"
            >
              <VStack p={5} spacing={5} align="start">
                <Heading size="lg">
                  {t('みんなの結果')}
                  <ExternalLinkIcon mx={2} />
                </Heading>
                <Text>{t('shared-results-description')}</Text>
              </VStack>
            </ExternalLink>
          </Card>
        </GridItem>
      </SimpleGrid>
    </VStack>
  )
}
