
export default function TweetIntent({
    questLaps,
    url
}: {
    questLaps: {area: string, name: string, lap: number}[],
    url: string
}) {
    const displayedLaps = questLaps
        .slice()
        .sort((a, b) => (b.lap - a.lap))
        .slice(0, 3)
        .map(({area, name, lap}) => (`${area} ${name} ${lap}周`))
        .join('\r\n')
    const lapSum = questLaps.map(({lap}) => lap).reduce((acc, cur) => (acc + cur), 0)
    const text = `必要な周回数:
${displayedLaps}${questLaps.length > 3 && "など"}
合計 ${lapSum}周
詳細: `
    const hashtags = 'FGO周回ソルバー'
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}`

    return (
        <>
            <a
                className="twitter-share-button"
                href={intentUrl}
                data-size="large"
            >
                <svg  width="24px" height="24px">
                    <svg aria-hidden="true" focusable="false" data-prefix="fab" data-icon="twitter" className="svg-inline--fa fa-twitter fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z"></path></svg>
                </svg>
                <p>結果をツイートする</p>
            </a>
            <style jsx>{`
                a {
                    display: flex;
                    align-items: center;
                }
                p {
                    margin-left: .5rem;
                }
            `}</style>
        </>
    )
}