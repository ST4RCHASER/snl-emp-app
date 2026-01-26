import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWindowStore } from "@/stores/windowStore";

interface WindowContextValue {
  windowId: string;
  refreshKey: number;
  windowProps?: Record<string, unknown>;
}

export const WindowContext = createContext<WindowContextValue>({
  windowId: "",
  refreshKey: 0,
});

export function useWindowRefreshKey() {
  return useContext(WindowContext).refreshKey;
}

export function useWindowProps<T = Record<string, unknown>>(): T | undefined {
  return useContext(WindowContext).windowProps as T | undefined;
}

export function useWindowId() {
  return useContext(WindowContext).windowId;
}

/**
 * Hook to update window props (for persisting app state across reloads)
 */
export function useUpdateWindowProps() {
  const windowId = useWindowId();
  const updateWindowProps = useWindowStore((s) => s.updateWindowProps);

  return useCallback(
    (props: Record<string, unknown>) => {
      if (windowId) {
        updateWindowProps(windowId, props);
      }
    },
    [windowId, updateWindowProps],
  );
}

/**
 * Hook to update window title
 */
export function useUpdateWindowTitle() {
  const windowId = useWindowId();
  const updateWindowTitle = useWindowStore((s) => s.updateWindowTitle);

  return useCallback(
    (title: string) => {
      if (windowId) {
        updateWindowTitle(windowId, title);
      }
    },
    [windowId, updateWindowTitle],
  );
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
