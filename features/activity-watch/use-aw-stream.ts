/**
 * Manages the FocusHelper stream transport lifecycle.
 *
 * Reads awAdapterMode and awStreamHost from the settings store and
 * reactively creates or tears down a MacBridgeTransport whenever either
 * value changes. Also calls configureAdapter so the rest of the app always
 * queries the right data source.
 *
 * Mount once in the root layout — nowhere else needs to call configureAdapter.
 */

import { useEffect, useRef, useState } from "react";
import { configureAdapter } from "@/features/activity-watch/aw-adapter";
import { createMacBridgeTransport, MacBridgeTransport } from "@/features/activity-watch/awStreamTransport";
import { useSettingsStore } from "@/features/settings/settings-store";

export function useAwStream(): void {
  const awAdapterMode = useSettingsStore((s) => s.awAdapterMode);
  const awStreamHost = useSettingsStore((s) => s.awStreamHost);

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
      configureAdapter({ mode: "stream", transport });
    } else {
      configureAdapter({ mode: "localhost" });
    }

    return () => {
      transportRef.current?.disconnect();
      transportRef.current = null;
    };
  }, [awAdapterMode, debouncedHost]);
}
