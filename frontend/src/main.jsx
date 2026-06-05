import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unbekannter Fehler' }
  }

  componentDidCatch(error) {
    console.error('Uncaught app error:', error)
  }

  handleReset = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '560px',
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '20px'
          }}>
            <h1 style={{ margin: '0 0 10px', fontSize: '22px', color: '#0f172a' }}>App-Fehler erkannt</h1>
            <p style={{ margin: '0 0 10px', color: '#334155' }}>
              Die Oberfläche ist abgestürzt. Damit du nicht im Whitescreen landest, kannst du die Sitzung zurücksetzen.
            </p>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '14px' }}>
              Fehler: {this.state.message}
            </p>
            <button
              onClick={this.handleReset}
              style={{
                height: '42px',
                padding: '0 16px',
                border: '0',
                borderRadius: '10px',
                background: '#2563eb',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Sitzung zurücksetzen
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
)