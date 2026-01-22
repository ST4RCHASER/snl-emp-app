import { createContext, useContext, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface WindowContextValue {
  refreshKey: number;
  windowProps?: Record<string, unknown>;
}

export const WindowContext = createContext<WindowContextValue>({
  refreshKey: 0,
});

export function useWindowRefreshKey() {
  return useContext(WindowContext).refreshKey;
}

export function useWindowProps<T = Record<string, unknown>>(): T | undefined {
  return useContext(WindowContext).windowProps as T | undefined;
}

/**
 * Hook to invalidate queries when the window refresh button is clicked.
 * Pass the query keys that should be refetched.
 */
export function useWindowRefresh(queryKeys: string[][]) {
  const { refreshKey } = useContext(WindowContext);
  const queryClient = useQueryClient();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the first render (initial mount)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // Still refetch on mount to get fresh data
      queryKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      return;
    }

    // Invalidate all specified queries when refreshKey changes
    queryKeys.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: key });
    });
  }, [refreshKey, queryClient, queryKeys]);
}
