import { create } from 'zustand';

import { emitter, native } from '@/modules/chrona-stream';
import type { ActivityEvent, ConnectionStatus, StatusChangedPayload } from '@/modules/chrona-stream';

type StreamState = {
  /** Current transport connection status. */
  status: ConnectionStatus;
  /**
   * The most recent app-change or hello event from the Mac helper.
   * Null until the first meaningful event arrives.
   * Heartbeats are intentionally excluded — they carry no app data.
   */
  currentEvent: ActivityEvent | null;
  /**
   * Start Bonjour discovery and connect to the Chrona Helper.
   * No-op on non-iOS platforms or if already started.
   */
  start(): void;
  /** Disconnect and stop discovery. Resets status to "idle". */
  stop(): void;
};

// Module-level subscription references — owned outside the store so they
// survive store selector re-renders and can be cleaned up in stop().
type Sub = ReturnType<typeof emitter.addListener>;
let statusSub: Sub | null = null;
let eventSub: Sub | null = null;

export const useStreamStore = create<StreamState>()((set, get) => ({
  status: 'idle',
  currentEvent: null,

  start() {
    if (process.env.EXPO_OS !== 'ios') return;

    // Idempotent — tear down any existing subscriptions before re-attaching.
    statusSub?.remove();
    eventSub?.remove();

    statusSub = emitter.addListener('onStatusChanged', ({ status }: StatusChangedPayload) => {
      set({ status });
    });

    eventSub = emitter.addListener('onEvent', (event: ActivityEvent) => {
      // Skip heartbeats — they exist only to keep the TCP connection alive
      // and carry no app info (all fields except version/type/timestamp are empty).
      if (event.type !== 'heartbeat') {
        set({ currentEvent: event });
      }
    });

    native.start();
  },

  stop() {
    if (process.env.EXPO_OS !== 'ios') return;

    statusSub?.remove();
    eventSub?.remove();
    statusSub = null;
    eventSub = null;

    native.stop();
    set({ status: 'idle', currentEvent: null });
  },
}));
