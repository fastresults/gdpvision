import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { queryRetryDelay, shouldRetryQuery } from "./lib/query-retry";

export const getRouter = () => {
  // Loaders use ensureQueryData, which never retries by default; a single
  // transient 500 (e.g. a server function requested before the server has
  // finished loading it) would otherwise land the page on its error screen.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetryQuery, retryDelay: queryRetryDelay },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    scrollToTopSelectors: ["#app-scroll-root", "main", "window"],
    defaultPreloadStaleTime: 0,
  });

  return router;
};
