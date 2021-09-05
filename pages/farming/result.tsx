import Link from 'next/link'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import _ from 'underscore'
import { getS3 } from '../../lib/get-s3'
import { getLargeCategory } from '../../lib/get-large-category'
import Error from '../_error'
import Head from '../../components/head'
import QuestTable from '../../components/quest-table'
import SumTable from '../../components/sum-table'
import ItemTable from '../../components/item-table'
import TweetIntent from '../../components/tweet-intent'

export const getServerSideProps: GetServerSideProps = async (context) => {
    const itemsPromise = getS3('items_2021.csv')
    const questsPromise = getS3('quests_2021.csv')
    const dropsPromise = getS3('drop_rates_2021.csv')
    const [items, quests, drops] = await Promise.all([itemsPromise, questsPromise, dropsPromise])
    
    const itemInfo = items.reduce((acc: {[key: string]: {[key: string]:string}}, cur: {[key: string]: string}) => {
        acc[cur.id] = cur
        return acc
    }, {})

    const questInfo = quests.reduce((acc: {[key: string]: {[key: string]: string}}, cur: {[key: string]: string}) => {
        const {section, area, name, id, ap} = cur
        acc[cur.id] = {section, area, name, id, ap}
        return acc
    }, {})

    const questToDrops = _.groupBy(drops, (drop) => (drop.quest_id))

    return {
        props: {itemInfo, questInfo, questToDrops},
    }
}

export default function Result({
    itemInfo,
    questInfo,
    questToDrops
}: {
    itemInfo: {[key: string]: {[key: string]: string}},
    questInfo: {[key: string]: {area: string, name: string, id: string, ap: string}},
    questToDrops: {[key: string]: {item_id: string, drop_rate: string}[]}
}) {
    const router = useRouter()
    const query = router.query

    if (! ('quests' in query && 'items' in query && 'queries' in query)) {
        return (
            <Error statusCode={400}/>
        )
    }

    const queryQuests = query.quests as string
    const queryItems = query.items as string
    const queryQueries = query.queries as string

    if (!queryQuests || !queryItems || !queryQueries) {
        return (
            <>
                <h1>結果が見つかりませんでした</h1>
                <p>新しく追加された素材のためドロップ率のデータがない場合などがあります。</p>
                <p><Link href="/"><a>トップに戻る</a></Link></p>
            </>
        )
    }

    const questLaps = queryQuests.split(',').map((queryQuest) => {
        const [id, lap] = queryQuest.split(':')
        const area = questInfo[id].area
        const name = questInfo[id].name
        return {area, name, id, lap:parseInt(lap)}
    })

    const itemCounts = queryItems.split(',').map((queryItem) => {
        const [id, count] = queryItem.split(':')
        const category = itemInfo[id].category
        const name = itemInfo[id].name
        return {category, name, id, count: parseInt(count)}
    })

    const queryItemCounts = queryQueries.split(',').map((queryQuery) => {
        const [id, count] = queryQuery.split(':')
        const category = itemInfo[id].category
        const name = itemInfo[id].name
        return {category, name, id, count: parseInt(count)}
    })

    const itemToQuery = queryQueries.split(',').reduce((acc: {[key: string]: number}, cur: string) => {
        const [id, count] = cur.split(':')
        acc[id] = parseInt(count)
        return acc
    }, {})

    const lapGroups = _.groupBy(questLaps, lap => lap.area)
    const itemGroups = _.groupBy(itemCounts, item => item.category)
    const largeItemGroups = _.groupBy(Object.entries(itemGroups), ([category, _]) => getLargeCategory(category))

    const totalAp = typeof query.total_ap == 'string'
        ? parseInt(query.total_ap)
        : questLaps.map(({id, lap}) => (lap * parseInt(questInfo[id].ap))).reduce((acc, cur) => (acc + cur))
    
    const questIds = questLaps.map(({id}) => id)
    questToDrops = Object.fromEntries(Object.entries(questToDrops).filter(([questId, drops]) => (questIds.includes(questId))))

    return (
        <>
            <Head title="計算結果"/>
            <header>
                <h1>計算結果</h1>
            </header>
            <section>
                <header>
                    <h2>クエスト周回数</h2>
                </header>
                <QuestTable questGroups={lapGroups} questToDrops={questToDrops} itemIndexes={itemInfo as {[key: string]: {id: string, name: string}}}/>
            </section>
            <section>
                <details className="sum-details">
                    <summary>合計</summary>
                    <section>
                        <SumTable rows={[
                            {key: '周回数', value: questLaps.map(lap => lap.lap).reduce((acc, cur) => (acc + cur)), unit: '周'},
                            {key: 'AP', value: totalAp, unit: 'AP'},
                            {key: '聖晶石', value: Math.ceil(totalAp / 144), unit: '個'},
                            {key: '費用', value: (totalAp / 144 / 168).toFixed(1), unit: '万円'}
                        ]}/>
                    </section>
                </details>
            </section>
            <section>
                <TweetIntent
                    itemCounts={queryItemCounts}
                    questLaps={questLaps}
                    url={`https://fgo-farming-solver.vercel.app${router.asPath}`}
                />
            </section>
            <section>
                <header>
                    <h2>アイテム獲得数</h2>
                </header>
                {Object.entries(largeItemGroups).map(([largeCategory, itemGroups]) => (
                    <details className="item-details" key={largeCategory}>
                        <summary>{largeCategory}</summary>
                        <ItemTable itemGroups={itemGroups} itemToQuery={itemToQuery}/>
                    </details>
                ))}
            </section>
            <section>
                <p><Link href="/farming"><a>入力画面に戻る</a></Link></p>
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