import { requireNativeModule } from 'expo';
import { NativeModule } from 'expo-modules-core';

import type { ActivityEvent, StatusChangedPayload } from './ChronaStream.types';

declare class ChronaStreamNativeModule extends NativeModule<{
  onStatusChanged: (payload: StatusChangedPayload) => void;
  onEvent: (event: ActivityEvent) => void;
}> {
  /**
   * Start Bonjour discovery and connect to the first Chrona Helper found.
   * `token` is the previously-paired code, if any (from SecureStore) — pass
   * an empty string on first run before pairing has happened.
   */
  start(token: string): void;
  /** Cancel discovery and disconnect. */
  stop(): void;
  /** Remove the cached host/port from UserDefaults so the next connect uses Bonjour discovery. */
  clearCachedEndpoint(): void;
  /**
   * Submit a pairing code entered by the user in response to a
   * "pairing_required" status. Sends it as an auth attempt on the current
   * connection, or stores it for the next connection attempt.
   */
  submitPairingCode(code: string): void;
  /** Send current timer state to the Mac over the active connection. No-op if not connected. */
  sendTimerState(
    isTracking: boolean,
    projectId: string,
    projectName: string,
    projectColor: string,
    timerTitle: string,
    startTimestamp: string
  ): void;
}

const native = requireNativeModule<ChronaStreamNativeModule>('ChronaStream');
export const emitter = native;

export default native;
