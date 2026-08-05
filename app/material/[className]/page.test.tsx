import { describe, expect, it, vi } from 'vitest'

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => { throw new Error('not found') }),
}))

vi.mock('next/navigation', () => ({ notFound }))
vi.mock('../../../components/material/catalog-loader', () => ({
  MaterialCatalogLoader: () => null,
}))

import MaterialClassPage, { dynamicParams, generateMetadata, generateStaticParams } from './page'

describe('MaterialClassPage', () => {
  it('statically includes canonical material classes and loads a known class', async () => {
    expect(dynamicParams).toBe(false)
    expect(generateStaticParams()).toContainEqual({ className: 'beastEresh' })
    await expect(MaterialClassPage({ params: Promise.resolve({ className: 'saber' }) }))
      .resolves.toMatchObject({ props: { className: 'saber' } })
  })

  it('returns 404 for classes outside the catalog', async () => {
    await expect(MaterialClassPage({ params: Promise.resolve({ className: 'zzzz' }) }))
      .rejects.toThrow('not found')
    expect(notFound).toHaveBeenCalledOnce()
  })

  it('generates the class page title without loading the catalog', async () => {
    await expect(generateMetadata({ params: Promise.resolve({ className: 'saber' }) }))
      .resolves.toEqual({ title: 'セイバー | 育成素材計算機' })
  })
})
