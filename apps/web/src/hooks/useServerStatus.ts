import { useState, useEffect, useCallback, useRef } from "react";

const PING_INTERVAL = 30000; // 30 seconds
const PING_TIMEOUT = 5000; // 5 seconds timeout

export interface ServerStatus {
  isConnected: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
}

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>({
    isConnected: true, // Assume connected initially
    isChecking: false,
    lastChecked: null,
  });

  const pingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkConnection = useCallback(async () => {
    setStatus((prev) => ({ ...prev, isChecking: true }));

    try {
      const controller = new AbortController();
      pingTimeoutRef.current = setTimeout(
        () => controller.abort(),
        PING_TIMEOUT,
      );

      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(`${apiUrl}/api/preferences`, {
        method: "HEAD",
        credentials: "include",
        signal: controller.signal,
      });

      if (pingTimeoutRef.current) {
        clearTimeout(pingTimeoutRef.current);
      }

      setStatus({
        isConnected: response.ok || response.status === 401, // 401 means server is up but not authed
        isChecking: false,
        lastChecked: new Date(),
      });
    } catch {
      if (pingTimeoutRef.current) {
        clearTimeout(pingTimeoutRef.current);
      }

      setStatus({
        isConnected: false,
        isChecking: false,
        lastChecked: new Date(),
      });
    }
  }, []);

  // Initial check and set up interval
  useEffect(() => {
    checkConnection();

    intervalRef.current = setInterval(checkConnection, PING_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (pingTimeoutRef.current) {
        clearTimeout(pingTimeoutRef.current);
      }
    };
  }, [checkConnection]);

  // Also check when window regains focus
  useEffect(() => {
    const handleFocus = () => {
      checkConnection();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [checkConnection]);

  // Check when coming back online
  useEffect(() => {
    const handleOnline = () => {
      checkConnection();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [checkConnection]);

  return {
    ...status,
    retry: checkConnection,
  };
}
