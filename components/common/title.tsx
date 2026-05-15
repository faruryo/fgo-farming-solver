import { Head } from './head'

export const Title = ({ children }: { children?: string | string[] | null }) => {
  const title = children == null ? undefined : typeof children == 'string' ? children : children.join()
  return (
    <>
      <Head title={title} />
      <h1 className="text-2xl font-semibold my-8">{title}</h1>
    </>
  )
}
