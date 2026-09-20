import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{
        minHeight: this.props.fullPage ? '100vh' : 200,
        background: 'var(--bg-base, #0a0c0f)',
        color: '#fca5a5',
        padding: 32,
        fontFamily: 'var(--font-body, sans-serif)',
      }}>
        <h2 style={{ color: '#f0f2f5', marginBottom: 10, fontSize: 18 }}>
          {this.props.title || 'This section failed to load'}
        </h2>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.5 }}>
          {this.state.error.message || String(this.state.error)}
        </pre>
        <button
          className="btn btn-ghost"
          style={{ marginTop: 16 }}
          onClick={() => { this.setState({ error: null }); window.location.reload() }}
        >
          Reload
        </button>
      </div>
    )
  }
}
