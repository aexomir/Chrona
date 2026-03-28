import { EventEmitter, requireNativeModule } from 'expo';

import type { ActivityEvent, StatusChangedPayload } from './ChronaStream.types';

declare class ChronaStreamNativeModule {
  /** Start Bonjour discovery and connect to the first Chrona Helper found. */
  start(): void;
  /** Cancel discovery and disconnect. */
  stop(): void;
  /** Remove the cached host/port from UserDefaults so the next connect uses Bonjour discovery. */
  clearCachedEndpoint(): void;
  // Required by EventEmitter
  addListener(eventName: string, listener: (...args: unknown[]) => void): void;
  removeListeners(count: number): void;
}

const native = requireNativeModule<ChronaStreamNativeModule>('ChronaStream');
export const emitter = new EventEmitter<{
  onStatusChanged: [StatusChangedPayload];
  onEvent: [ActivityEvent];
}>(native);

export default native;
