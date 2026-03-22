import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'var(--font-family)',
        }}>
          <h1 style={{ fontSize: '2rem', color: '#14532d', marginBottom: '1rem' }}>
            Algo no ha salido bien
          </h1>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem', maxWidth: '480px' }}>
            Ha ocurrido un error inesperado. Por favor, recarga la pagina o vuelve al inicio.
          </p>
          <button
            onClick={() => window.location.assign('/')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#15803d',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Volver al inicio
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
