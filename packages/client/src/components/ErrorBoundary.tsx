/**
 * ErrorBoundary - React component that catches JavaScript errors in child components
 *
 * This component wraps around other components to catch errors during rendering,
 * in lifecycle methods, and in constructors of the whole tree below them.
 */

import React, { Component, ReactNode } from 'react';

/**
 * ErrorBoundary props
 */
export interface ErrorBoundaryProps {
  /**
   * Fallback UI to render when an error is caught
   */
  fallback?: ReactNode;

  /**
   * Custom error message
   */
  errorMessage?: string;

  /**
   * Function called when an error is caught
   */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;

  /**
   * Function to render custom fallback UI
   */
  renderFallback?: (error: Error, errorInfo: React.ErrorInfo) => ReactNode;

  /**
   * Child components to wrap
   */
  children: ReactNode;
}

/**
 * ErrorBoundary state
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Default error message
 */
const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try refreshing the page.';

/**
 * ErrorBoundary component
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with error tracking service (e.g., Sentry)
      // Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;

      // Use custom fallback renderer if provided
      if (this.props.renderFallback && error && errorInfo) {
        return this.props.renderFallback(error, errorInfo);
      }

      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="error-boundary" style={styles.container}>
          <h2 style={styles.heading}>{this.props.errorMessage || DEFAULT_ERROR_MESSAGE}</h2>

          {process.env.NODE_ENV === 'development' && error && (
            <details style={styles.details}>
              <summary style={styles.summary}>Error Details</summary>
              <pre style={styles.pre}>
                {error.toString()}
                {'\n\n'}
                {errorInfo?.componentStack}
              </pre>
            </details>
          )}

          <button onClick={this.handleReset} style={styles.button} type="button">
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Inline styles for error boundary
 */
const styles = {
  container: {
    padding: '2rem',
    textAlign: 'center' as const,
    backgroundColor: '#fff5f5',
    border: '1px solid #fc8181',
    borderRadius: '8px',
    margin: '1rem',
  },
  heading: {
    color: '#c53030',
    marginBottom: '1rem',
    marginTop: '0',
  },
  details: {
    marginTop: '1.5rem',
    textAlign: 'left' as const,
  },
  summary: {
    cursor: 'pointer',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
  },
  pre: {
    backgroundColor: '#2d3748',
    color: '#e2e8f0',
    padding: '1rem',
    borderRadius: '4px',
    overflow: 'auto',
    fontSize: '0.875rem',
    maxHeight: '300px',
  },
  button: {
    marginTop: '1.5rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: '#3182ce',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 'bold',
  } as const,
};

/**
 * HOC to wrap a component with ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.ComponentType<P> {
  const WithErrorBoundary = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithErrorBoundary;
}
