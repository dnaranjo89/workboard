/* eslint-disable react-refresh/only-export-components */
import { Component } from "react";
import { StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import "./styles.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  reset = () => {
    window.localStorage.removeItem("workboard.accessKey");
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="setup-shell">
        <section className="setup-panel">
          <p className="eyebrow">Could not load board</p>
          <h1>Check the access key</h1>
          <p>{this.state.error.message}</p>
          <button className="primary-button" onClick={this.reset} type="button">
            Try again
          </button>
        </section>
      </main>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {convexUrl ? (
      <ConvexProvider client={new ConvexReactClient(convexUrl)}>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </ConvexProvider>
    ) : (
      <MissingConfig />
    )}
  </StrictMode>,
);

function MissingConfig() {
  return (
    <main className="setup-shell">
      <section className="setup-panel">
        <p className="eyebrow">Configuration needed</p>
        <h1>Connect Workboard to Convex</h1>
        <p>
          Set <code>VITE_CONVEX_URL</code> in <code>.env.local</code> or in
          Vercel. Convex will create this value when you run{" "}
          <code>npx convex dev</code>.
        </p>
      </section>
    </main>
  );
}
