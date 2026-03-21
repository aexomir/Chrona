import { useEffect } from 'react';

import native, { emitter } from './src/WatchConnectivityModule';
import type { WatchMessage } from './src/WatchConnectivity.types';

export type { WatchMessage };

/**
 * Send state to the Apple Watch (updates the watch UI).
 * Falls back to updateApplicationContext when the watch isn't immediately reachable.
 */
export async function sendToWatch(message: WatchMessage): Promise<void> {
  return native.sendToWatch(message);
}

/**
 * Returns true if the paired watch app is currently reachable (foreground + in range).
 */
export function isWatchReachable(): boolean {
  return native.isReachable();
}

/**
 * Subscribe to messages sent from the watch (e.g. button presses).
 *
 * @example
 * const unsub = onWatchMessage((msg) => {
 *   if (msg.action === 'start') startSession();
 * });
 * // cleanup:
 * unsub();
 */
export function onWatchMessage(
  handler: (message: WatchMessage) => void
): () => void {
  const sub = emitter.addListener('onWatchMessage', handler);
  return () => sub.remove();
}

/**
 * React hook — subscribes for the lifetime of the component.
 *
 * @example
 * useWatchMessages((msg) => {
 *   if (msg.action === 'start') startSession();
 * });
 */
export function useWatchMessages(handler: (message: WatchMessage) => void) {
  useEffect(() => {
    return onWatchMessage(handler);
  }, [handler]);
}
