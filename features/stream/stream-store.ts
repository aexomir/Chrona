import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

import { emitter, native } from '@/modules/chrona-stream';
import type { ActivityEvent, ConnectionStatus, StatusChangedPayload } from '@/modules/chrona-stream';

const PAIRING_TOKEN_KEY = 'chrona.macHelper.pairingToken';

function getStoredToken(): string {
  if (process.env.EXPO_OS !== 'ios') return '';
  return SecureStore.getItem(PAIRING_TOKEN_KEY) ?? '';
}

type StreamState = {
  status: ConnectionStatus;
  pathSatisfied: boolean;
  currentEvent: ActivityEvent | null;
  lastEventTime: number | null;
  lastHeartbeat: number | null;
  /** True once a "pairing_required"/"auth_failed" status has been seen, until "connected". */
  needsPairing: boolean;
  start(): void;
  stop(): void;
  reconnect(): void;
  clearEndpointCache(): void;
  submitPairingCode(code: string): void;
  sendTimerState(
    isTracking: boolean,
    projectId: string,
    projectName: string,
    projectColor: string,
    timerTitle: string,
    startTimestamp: string
  ): void;
};

type Sub = ReturnType<typeof emitter.addListener>;
let statusSub: Sub | null = null;
let eventSub: Sub | null = null;
let pendingCode: string | null = null;

export const useStreamStore = create<StreamState>()((set, get) => ({
  status: 'idle',
  pathSatisfied: false,
  currentEvent: null,
  lastEventTime: null,
  lastHeartbeat: null,
  needsPairing: false,

  start() {
    if (process.env.EXPO_OS !== 'ios') return;

    statusSub?.remove();
    eventSub?.remove();

    statusSub = emitter.addListener('onStatusChanged', ({ status, pathSatisfied }: StatusChangedPayload) => {
      if (status === 'connected') {
        // If we just authenticated with a code the user entered this
        // session, it's now proven valid — persist it for future reconnects.
        if (pendingCode) {
          SecureStore.setItem(PAIRING_TOKEN_KEY, pendingCode);
          pendingCode = null;
        }
        set({ status, pathSatisfied, needsPairing: false });
      } else if (status === 'pairing_required' || status === 'auth_failed') {
        if (status === 'auth_failed') {
          // The stored code was rejected (likely regenerated on the Mac) — drop it.
          SecureStore.deleteItemAsync(PAIRING_TOKEN_KEY).catch(() => {});
          pendingCode = null;
        }
        set({ status, pathSatisfied, needsPairing: true });
      } else {
        set({ status, pathSatisfied });
      }
    });

    eventSub = emitter.addListener('onEvent', (event: ActivityEvent) => {
      if (event.type === 'heartbeat') {
        set({ lastHeartbeat: Date.now() });
      } else if (event.type === 'app_change' || event.type === 'hello') {
        set({ currentEvent: event, lastEventTime: Date.now() });
      }
    });

    native.start(getStoredToken());
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

  submitPairingCode(code) {
    if (process.env.EXPO_OS !== 'ios') return;
    pendingCode = code;
    native.submitPairingCode(code);
  },

  sendTimerState(isTracking, projectId, projectName, projectColor, timerTitle, startTimestamp) {
    if (process.env.EXPO_OS !== 'ios') return;
    native.sendTimerState(isTracking, projectId, projectName, projectColor, timerTitle, startTimestamp);
  },
}));
