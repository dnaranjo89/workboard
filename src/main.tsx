/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import "./styles.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {convexUrl ? (
      <ConvexProvider client={new ConvexReactClient(convexUrl)}>
        <App />
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
