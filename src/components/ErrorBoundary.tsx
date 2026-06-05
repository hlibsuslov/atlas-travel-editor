import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. Prevents a render-time exception in any subtree from
 * blanking the whole app, and gives the user a recovery path. In production,
 * `componentDidCatch` is where you'd forward to Sentry/your error tracker.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="error-screen" role="alert">
            <h1>Something went wrong</h1>
            <p className="helper">{this.state.error.message}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
