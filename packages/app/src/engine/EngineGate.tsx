import { useEffect, useState, type ReactNode } from "react";
import { loadEngine } from "./engine.ts";

/** Shows a splash until the engine chunk has loaded, then renders its children. */
export function EngineGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    loadEngine().then(
      () => setState("ready"),
      () => setState("failed"),
    );
  }, []);

  if (state === "ready") return children;
  return (
    <div className="py-8 text-center">
      <p role="status">
        {state === "loading" ? "Loading the rules engine…" : "The rules engine failed to load. Reload the page to try again."}
      </p>
    </div>
  );
}
