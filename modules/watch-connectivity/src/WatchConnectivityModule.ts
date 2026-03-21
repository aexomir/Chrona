import { EventEmitter, requireNativeModule } from 'expo';

import type { WatchMessage } from './WatchConnectivity.types';

declare class WatchConnectivityNativeModule {
  sendToWatch(message: WatchMessage): Promise<void>;
  isReachable(): boolean;
  addListener(eventName: string, listener: (event: WatchMessage) => void): void;
  removeListeners(count: number): void;
}

const native = requireNativeModule<WatchConnectivityNativeModule>('WatchConnectivity');
export const emitter = new EventEmitter(native);
export default native;
