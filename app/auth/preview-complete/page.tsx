import { Suspense } from 'react'
import { PreviewAuthComplete } from '../../../components/auth/preview-complete'

export const dynamic = 'force-dynamic'

export default function PreviewAuthCompletePage() {
  return (
    <Suspense>
      <PreviewAuthComplete />
    </Suspense>
  )
}
