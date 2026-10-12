"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * TEMPORARY: a page-level try/catch can't catch an error thrown while React
 * renders a nested Client Component - by the time that render happens, the
 * parent Server Component's own function has already returned. Only a real
 * React error boundary intercepts that, and unlike a Server Component error
 * crossing to the client (which Next.js scrubs to a generic "Minified React
 * error #441" in production), a client-side catch here keeps the original,
 * unscrubbed message and stack. Remove once the "Create agent" crash is
 * fixed and Vercel runtime log access is restored.
 */
export class DiagnosticErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("DiagnosticErrorBoundary caught", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <pre className="whitespace-pre-wrap break-all rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-xs text-destructive">
          {JSON.stringify(
            {
              name: this.state.error.name,
              message: this.state.error.message,
              stack: this.state.error.stack,
            },
            null,
            2
          )}
        </pre>
      );
    }
    return this.props.children;
  }
}
