import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ padding: 28, maxWidth: 560 }}>
        <h1 className="ax-page-title">Something went wrong</h1>
        <p className="ax-page-sub">The page hit an unexpected error and stopped rendering.</p>
        <pre
          style={{
            background: 'var(--color-background-secondary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 6,
            padding: 10,
            fontSize: 11,
            overflow: 'auto',
            maxHeight: 220,
          }}
        >
          {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
        </pre>
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          <button className="ax-btn prim" onClick={this.reset}>Try again</button>
          <button className="ax-btn" onClick={() => (window.location.href = '/')}>Go to dashboard</button>
        </div>
      </div>
    )
  }
}
