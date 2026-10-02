import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { EngineGate } from "./engine/EngineGate.tsx";
import "./index.css";
import { routes } from "./routes/routes.tsx";

const queryClient = new QueryClient();
const router = createBrowserRouter(routes);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <EngineGate>
        <RouterProvider router={router} />
      </EngineGate>
    </QueryClientProvider>
  </StrictMode>,
);
