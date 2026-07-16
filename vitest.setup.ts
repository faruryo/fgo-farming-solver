// Global vitest setup. Loaded for every test file (node + jsdom).
//
// jest-dom matcher registration is harmless under the default 'node'
// environment (it only extends `expect`), so we can keep a single setup
// file instead of forking config per environment.
import '@testing-library/jest-dom/vitest'

// Only wire up DOM-only bits (RTL cleanup, ResizeObserver/matchMedia
// polyfills for @base-ui/react components) when a `document` actually
// exists, i.e. in files opted into `// @vitest-environment jsdom`.
if (typeof document !== 'undefined') {
  const { afterEach } = await import('vitest')
  const { cleanup } = await import('@testing-library/react')

  afterEach(() => {
    cleanup()
  })

  // jsdom does not implement ResizeObserver; @base-ui/react primitives
  // (Switch, Tooltip) reference it on mount.
  if (!('ResizeObserver' in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub
  }

  // jsdom does not implement matchMedia; @base-ui/react uses it to detect
  // pointer/hover capability.
  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
  }
}
