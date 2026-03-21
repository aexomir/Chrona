export type WatchMessage = Record<string, unknown>;

export type WatchMessageEvent = {
  /** Arbitrary key-value payload sent from the watch. */
  [key: string]: unknown;
};
