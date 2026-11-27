import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: "",
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || "Ocorreu uma falha inesperada na interface.",
    };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary capturou um erro:", error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback" role="alert">
          <div className="error-boundary-card">
            <span className="error-boundary-icon" aria-hidden="true">
              🛡️
            </span>
            <h2>Algo inesperado aconteceu</h2>
            <p>{this.state.errorMessage}</p>
            <div className="error-boundary-actions">
              <button type="button" className="btn-primary-submit" onClick={this.handleReset}>
                Tentar recuperar interface
              </button>
              <button
                type="button"
                className="action-pill action-pill-maps"
                onClick={() => window.location.reload()}
              >
                Recarregar página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
