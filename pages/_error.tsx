import Link from 'next/link'
import Head from '../components/head'

const statusCodes: { [code: number]: string } = {
    400: 'Bad Request',
    404: 'Not Found',
    405: 'Mothod Not Allowed',
    500: 'Internal Server Error',
}

export default function Error({
    statusCode,
    title,
    message
}: {
    statusCode: number,
    title?: string,
    message?: string | string[]
}) {
    title = title || statusCodes[statusCode] || 'An unexpected error has occured'
    return (
        <>
            <Head title={`${statusCode} ${title}`}/>
            <h1><span className="status-code">{statusCode}</span>{' '}<span className="title">{title}</span></h1>
            {Array.isArray(message)
            ? message.map(m => <p>{m}</p>)
            : <p>{message}</p>
            }
            <p><Link href="/"><a>トップに戻る</a></Link></p>
            <style jsx>{`
                .status-code {
                    font-weight: bold;
                }
                .title {
                    font-weight: normal;
                }
            `}</style>
        </>
    )
}