import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTrpcClient } from "./trpc";
import { FiltersProvider } from "./state/filters";
import { App } from "./App";
import "./styles/globals.css";

const queryClient = new QueryClient({
  defaultOptions: {
    // refetchOnWindowFocus complements the SSE live updates (useLiveUpdates):
    // stale queries refetch on focus even if a version event was missed.
    queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 10_000 },
  },
});
const trpcClient = createTrpcClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <FiltersProvider>
          <App />
        </FiltersProvider>
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>,
);
