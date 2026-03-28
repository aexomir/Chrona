import { create } from 'zustand';

import { emitter, native } from '@/modules/chrona-stream';
import type { ActivityEvent, ConnectionStatus, StatusChangedPayload } from '@/modules/chrona-stream';

type StreamState = {
  status: ConnectionStatus;
  pathSatisfied: boolean;
  currentEvent: ActivityEvent | null;
  lastEventTime: number | null;
  lastHeartbeat: number | null;
  start(): void;
  stop(): void;
  reconnect(): void;
  clearEndpointCache(): void;
};

type Sub = ReturnType<typeof emitter.addListener>;
let statusSub: Sub | null = null;
let eventSub: Sub | null = null;

export const useStreamStore = create<StreamState>()((set, get) => ({
  status: 'idle',
  pathSatisfied: false,
  currentEvent: null,
  lastEventTime: null,
  lastHeartbeat: null,

  start() {
    if (process.env.EXPO_OS !== 'ios') return;

    statusSub?.remove();
    eventSub?.remove();

    statusSub = emitter.addListener('onStatusChanged', ({ status, pathSatisfied }: StatusChangedPayload) => {
      set({ status, pathSatisfied });
    });

    eventSub = emitter.addListener('onEvent', (event: ActivityEvent) => {
      if (event.type === 'heartbeat') {
        set({ lastHeartbeat: Date.now() });
      } else if (event.type === 'app_change' || event.type === 'hello') {
        set({ currentEvent: event, lastEventTime: Date.now() });
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
    set({ status: 'idle', pathSatisfied: false, currentEvent: null, lastEventTime: null, lastHeartbeat: null });
  },

  reconnect() {
    if (process.env.EXPO_OS !== 'ios') return;
    get().stop();
    get().start();
  },

  clearEndpointCache() {
    if (process.env.EXPO_OS !== 'ios') return;
    native.clearCachedEndpoint();
  },
}));
