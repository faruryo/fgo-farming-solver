'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // ChunkLoadError happens when the browser has cached old JS chunk references
    // after a new deployment. Hard reload to get the latest chunks.
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      window.location.reload()
    }
  }, [error])

  return null
}
