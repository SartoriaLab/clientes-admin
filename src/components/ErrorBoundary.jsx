import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-red-200 shadow-sm">
            <h1 className="text-lg font-bold text-red-600 mb-2">Algo deu errado</h1>
            <p className="text-sm text-slate-600 mb-4">{this.state.error.message || String(this.state.error)}</p>
            <div className="flex gap-2">
              <button
                onClick={this.reset}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600"
              >
                Tentar novamente
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-100"
              >
                Recarregar página
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
