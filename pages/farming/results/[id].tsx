import { GetStaticProps, GetStaticPaths } from 'next'
import Head from '../../../components/head'
import Link from 'next/link'
import _ from 'underscore'
import { DBError, getDynamoDb } from '../../../lib/dynamodb'
import { getLargeCategory } from '../../../lib/get-large-category'
import { useRouter } from 'next/router'
import Spinner from '../../../components/spinner'
import QuestTable from '../../../components/quest-table'
import SumTable from '../../../components/sum-table'
import TweetIntent from '../../../components/tweet-intent'
import ItemTable from '../../../components/item-table'

type Params = {
  objective: string
  items: { [key: string]: number }
  quests: string[]
}
type Quest = {
  id: string
  section: string
  area: string
  name: string
  lap: number
}
type Item = { id: string; category: string; name: string; count: number }
type DropRate = {
  quest_id: string
  quest_name: string
  item_id: string
  item_name: string
  drop_rate: number
}

export const getStaticPaths: GetStaticPaths = async () => {
  return { paths: [], fallback: true }
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const notFound: { notFound: true } = { notFound: true }
  if (params == null || typeof params.id !== 'string') {
    return notFound
  }
  const res = await getDynamoDb({
    tableName: 'fgo-farming-solver-results',
    key: { id: params.id },
  })
    .then((result) => ({ props: result }))
    .catch((error) => {
      if (!(error instanceof DBError)) console.log(error)
      return notFound
    })
  return res
}

const Result = ({
  params,
  quests,
  items,
  drop_rates,
  total_ap,
  total_lap,
}: {
  params: Params
  quests: Quest[]
  items: Item[]
  drop_rates: DropRate[]
  total_lap: number
  total_ap: number
}) => {
  const router = useRouter()

  if (router.isFallback) {
    return <Spinner message={'読み込み中'} />
  }

  if (quests && quests.length == 0) {
    return (
      <>
        <h1>結果が見つかりませんでした</h1>
        <p>
          新しく追加された素材のためドロップ率のデータがない場合などがあります。
        </p>
        <p>
          <Link href="/">
            <a>トップに戻る</a>
          </Link>
        </p>
      </>
    )
  }

  const itemIndexes = _.indexBy(items, 'id')
  const paramItems = Object.entries(params.items).map(([id, count]) => ({
    ...itemIndexes[id],
    count,
  }))
  const lapGroups = _.groupBy(quests, (quest) => quest.area)
  const itemGroups = _.groupBy(items, (item) => item.category)
  const largeItemGroups = _.groupBy(
    Object.entries(itemGroups),
    ([category, _]) => getLargeCategory(category)
  )
  const questToDrops = _.groupBy(drop_rates, (row) => row.quest_id)

  return (
    <>
      <Head title="計算結果" />
      <header>
        <h1>計算結果</h1>
      </header>
      <section>
        <header>
          <h2>クエスト周回数</h2>
        </header>
        <QuestTable
          questGroups={lapGroups}
          questToDrops={questToDrops}
          itemIndexes={itemIndexes}
        />
      </section>
      <section>
        <details className="sum-details">
          <summary>合計</summary>
          <section>
            <SumTable
              rows={[
                { key: '周回数', value: total_lap, unit: '周' },
                { key: 'AP', value: total_ap, unit: 'AP' },
                { key: '聖晶石', value: Math.ceil(total_ap / 144), unit: '個' },
                {
                  key: '費用',
                  value: (total_ap / 144 / 168).toFixed(1),
                  unit: '万円',
                },
              ]}
            />
          </section>
        </details>
      </section>
      <section>
        <TweetIntent
          itemCounts={paramItems}
          questLaps={quests}
          url={`${
            process.env.VERCEL_URL || 'https://fgo-farming-solver.vercel.app'
          }${router.asPath}`}
        />
      </section>
      <section>
        <header>
          <h2>アイテム獲得数</h2>
        </header>
        {Object.entries(largeItemGroups).map(([largeCategory, itemGroups]) => (
          <details className="item-details" key={largeCategory}>
            <summary>{largeCategory}</summary>
            <ItemTable itemGroups={itemGroups} itemToQuery={params.items} />
          </details>
        ))}
      </section>
      <section>
        <p>
          <Link href="/farming">
            <a>入力画面に戻る</a>
          </Link>
        </p>
      </section>
      <style jsx>{`
        .sum-details {
          width: 14rem;
        }
        .item-details {
          width: 16rem;
        }
      `}</style>
    </>
  )
}

export default Result
