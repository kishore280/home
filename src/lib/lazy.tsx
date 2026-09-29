import { Suspense, use, type ComponentType, type ReactPromise } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

type Module<P> = { default: ComponentType<P> }

// Like React.lazy, but a module that has already loaded renders at once. React.lazy suspends on
// its first render even then, and React 19 holds a Suspense reveal for 300 ms (react/react#31819).
// use() reads a promise's status/value fields synchronously (the `use` RFC), as Outline does
// (outline/outline#13817). preload() starts the download early: on hover, focus or idle.
// If the download fails (offline, a file removed by a new deploy), it shows nothing instead of
// breaking the page (React docs: lazy + an error boundary).
export function lazyPreload<P extends object>(load: () => Promise<Module<P>>) {
  let promise: ReactPromise<Module<P>> | undefined
  const preload = () => {
    if (!promise) {
      const p = Object.assign(load(), { status: 'pending' as const })
      p.then(
        (value) => Object.assign(p, { status: 'fulfilled', value }),
        (reason: unknown) => Object.assign(p, { status: 'rejected', reason }),
      )
      promise = p
    }
    return promise
  }
  const Inner = (props: P) => {
    const Component = use(preload()).default
    return <Component {...props} />
  }
  const Lazy = (props: P) => (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <Inner {...props} />
      </Suspense>
    </ErrorBoundary>
  )
  return Object.assign(Lazy, { preload })
}

// "Idle until urgent" (Philip Walton): load when the browser is idle, or at once when needed.
// Safari has no requestIdleCallback, so it waits for a timeout there.
export function whenIdle(task: () => void) {
  if ('requestIdleCallback' in window) requestIdleCallback(task, { timeout: 3000 })
  else setTimeout(task, 1000)
}
