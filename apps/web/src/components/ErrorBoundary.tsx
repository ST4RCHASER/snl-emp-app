import React, { Component, type ReactNode } from "react";
import {
  ErrorCircle24Regular,
  ArrowClockwise24Regular,
  Dismiss24Regular,
  Bug24Regular,
} from "@fluentui/react-icons";

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
    // You could also log to an error reporting service here
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    this.props.onReset?.();
  };

  handleCloseAllWindows = () => {
    // Clear window state from localStorage and reload
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.includes("window") || key.includes("zustand")) {
          localStorage.removeItem(key);
        }
      });
    } catch {
      // Ignore localStorage errors
    }
    window.location.reload();
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      // Use plain CSS colors since FluentUI tokens may not be available in error state
      const colors = {
        background: "#1f1f1f",
        cardBg: "#2d2d2d",
        text: "#ffffff",
        textSecondary: "#a0a0a0",
        border: "#404040",
        error: "#dc2626",
      };

      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
            padding: 24,
            zIndex: 10000,
          }}
        >
          <div
            style={{
              maxWidth: 500,
              width: "100%",
              background: colors.cardBg,
              borderRadius: 16,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                padding: "32px 24px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <ErrorCircle24Regular style={{ fontSize: 40, color: "#fff" }} />
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                Something went wrong
              </h1>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 14,
                  color: "rgba(255, 255, 255, 0.8)",
                }}
              >
                An unexpected error occurred in the application
              </p>
            </div>

            {/* Content */}
            <div style={{ padding: 24 }}>
              {/* Error Summary */}
              <div
                style={{
                  background: colors.background,
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 8,
                    color: colors.text,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Bug24Regular style={{ color: colors.error }} />
                  Error Details
                </div>
                <code
                  style={{
                    display: "block",
                    fontSize: 13,
                    color: colors.error,
                    wordBreak: "break-word",
                  }}
                >
                  {this.state.error?.message || "Unknown error"}
                </code>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <button
                  onClick={this.handleReload}
                  style={{
                    width: "100%",
                    padding: "12px 24px",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#fff",
                    background:
                      "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <ArrowClockwise24Regular />
                  Reload Page
                </button>

                <button
                  onClick={this.handleCloseAllWindows}
                  style={{
                    width: "100%",
                    padding: "12px 24px",
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.text,
                    background: colors.background,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Dismiss24Regular />
                  Close All Windows & Reload
                </button>

                <button
                  onClick={this.toggleDetails}
                  style={{
                    width: "100%",
                    padding: "8px 16px",
                    fontSize: 13,
                    color: colors.textSecondary,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    marginTop: 8,
                  }}
                >
                  {this.state.showDetails
                    ? "Hide Technical Details"
                    : "Show Technical Details"}
                </button>
              </div>

              {/* Technical Details (collapsible) */}
              {this.state.showDetails && this.state.errorInfo && (
                <div
                  style={{
                    marginTop: 16,
                    background: colors.background,
                    borderRadius: 8,
                    padding: 12,
                    maxHeight: 200,
                    overflow: "auto",
                  }}
                >
                  <pre
                    style={{
                      margin: 0,
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: colors.textSecondary,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: `1px solid ${colors.border}`,
                textAlign: "center",
                fontSize: 12,
                color: colors.textSecondary,
              }}
            >
              If this problem persists, please contact support
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
