import { Component, type ErrorInfo, type ReactNode } from "react"

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Without this, any render-time throw unmounts the tree and leaves an empty
 * #root — an unstyled white page with nothing to go on. Show the error instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("GPU Visualiser failed to render:", error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="crash">
        <h1 className="crash-title">The visualiser failed to load</h1>
        <p className="crash-hint">
          If you are seeing this after an update, a hard reload (Ctrl/Cmd + Shift + R) clears a
          stale cached build.
        </p>
        <pre className="crash-detail">{error.message}</pre>
        <button className="crash-reload" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}
