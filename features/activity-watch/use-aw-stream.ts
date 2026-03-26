/**
 * Manages the ChronaHelper stream transport lifecycle.
 *
 * Reads awAdapterMode and awStreamHost from the settings store and
 * reactively creates or tears down a MacBridgeTransport whenever either
 * value changes. Also calls configureAdapter so the rest of the app always
 * queries the right data source.
 *
 * Mount once in the root layout — nowhere else needs to call configureAdapter.
 * Returns the current reconnect state for UI display.
 */

import {
  configureAdapter,
  onHello,
} from "@/features/activity-watch/aw-adapter";
import {
  createMacBridgeTransport,
  MacBridgeTransport,
} from "@/features/activity-watch/awStreamTransport";
import { useSettingsStore } from "@/features/settings/settings-store";
import { useEffect, useRef, useState } from "react";

export interface ReconnectState {
  isReconnecting: boolean;
  attempt: number;
  delayMs: number | null;
}

export function useAwStream(): ReconnectState {
  const awAdapterMode = useSettingsStore((s) => s.awAdapterMode);
  const awStreamHost = useSettingsStore((s) => s.awStreamHost);
  const addRecentHost = useSettingsStore((s) => s.addRecentHost);

  const [reconnectState, setReconnectState] = useState<ReconnectState>({
    isReconnecting: false,
    attempt: 0,
    delayMs: null,
  });

  // Debounce host changes so that typing in the Collector Host field doesn't
  // create a new transport attempt on every keystroke.
  const [debouncedHost, setDebouncedHost] = useState(awStreamHost);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedHost(awStreamHost), 600);
    return () => clearTimeout(timer);
  }, [awStreamHost]);

  const transportRef = useRef<MacBridgeTransport | null>(null);

  useEffect(() => {
    if (transportRef.current) {
      transportRef.current.disconnect();
      transportRef.current = null;
    }

    if (awAdapterMode === "stream") {
      const transport = createMacBridgeTransport(debouncedHost);
      transportRef.current = transport;

      // Subscribe to reconnect state changes
      transport.onReconnectStateChange((state) => {
        setReconnectState(
          state
            ? {
                isReconnecting: true,
                attempt: state.attempt,
                delayMs: state.delayMs,
              }
            : { isReconnecting: false, attempt: 0, delayMs: null },
        );
      });

      configureAdapter({ mode: "stream", transport });
    } else {
      configureAdapter({ mode: "localhost" });
      // Clear reconnect state when switching to localhost
      setReconnectState({ isReconnecting: false, attempt: 0, delayMs: null });
    }

    return () => {
      transportRef.current?.disconnect();
      transportRef.current = null;
    };
  }, [awAdapterMode, debouncedHost]);

  useEffect(() => {
    if (awAdapterMode !== "stream") return;
    return onHello((hostname) => {
      addRecentHost(hostname);
    });
  }, [awAdapterMode, addRecentHost]);

  return reconnectState;
}
