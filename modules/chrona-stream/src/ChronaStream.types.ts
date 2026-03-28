export type ConnectionStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnected';

export type ActivityEventType = 'app_change' | 'heartbeat' | 'hello' | 'pong';

export type ActivityEvent = {
  /** Protocol version — currently always 1. */
  version: number;
  /** Discriminates the kind of observation. */
  type: ActivityEventType;
  /** Localised display name of the frontmost app, e.g. "Xcode". Empty on heartbeat. */
  appName: string;
  /** Title of the focused window. Empty when Accessibility is denied or on heartbeat. */
  windowTitle: string;
  /** Reverse-DNS bundle ID, e.g. "com.apple.dt.Xcode". Empty on heartbeat. */
  bundleId: string;
  /** Unix timestamp with millisecond precision. */
  timestamp: number;
};

export type StatusChangedPayload = {
  status: ConnectionStatus;
  pathSatisfied: boolean;
};
