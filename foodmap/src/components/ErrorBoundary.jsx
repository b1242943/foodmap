import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            width: "100vw",
            background: "var(--bg-secondary)",
            fontFamily: "var(--font-family)",
            padding: 24,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              maxWidth: 600,
              width: "100%",
              background: "var(--bg-primary)",
              border: "2px solid var(--border-color)",
              borderRadius: "var(--border-radius)",
              padding: 40,
              textAlign: "center",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <span style={{ fontSize: 64, display: "block", marginBottom: 20 }}>⚠️</span>
            <h1
              style={{
                fontSize: "var(--font-size-2xl)",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 16,
              }}
            >
              System Interrupted
            </h1>
            <p
              style={{
                fontSize: "var(--font-size-base)",
                color: "var(--text-secondary)",
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              An unexpected error occurred in this view. The system stability layer captured the diagnostic traceback, and you can securely reload or report the issue below.
            </p>

            {/* Collapsible Error Diagnostics */}
            <details
              style={{
                textAlign: "left",
                background: "rgba(0, 0, 0, 0.03)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--border-radius)",
                padding: "16px",
                marginBottom: 24,
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "var(--font-size-sm)",
                  color: "var(--text-secondary)",
                  userSelect: "none",
                }}
              >
                Show Technical Traceback
              </summary>
              <pre
                style={{
                  marginTop: 12,
                  marginBottom: 0,
                  fontSize: "13px",
                  color: "var(--color-desert)",
                  fontFamily: "Courier, monospace",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.4,
                  maxHeight: "200px",
                  overflowY: "auto",
                }}
              >
                <strong>Error:</strong> {this.state.error && this.state.error.toString()}
                {"\n\n"}
                <strong>Stack:</strong> {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>

            <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
              <button
                className="btn-primary"
                onClick={() => window.location.reload()}
                style={{
                  height: 52,
                  fontSize: "var(--font-size-base)",
                  minWidth: 180,
                }}
              >
                Reload Application
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                style={{
                  height: 52,
                  background: "transparent",
                  border: "2px solid var(--border-color)",
                  color: "var(--text-secondary)",
                  fontSize: "var(--font-size-base)",
                  padding: "0 24px",
                  borderRadius: "var(--border-radius)",
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
