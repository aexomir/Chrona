export type ConnectionStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'pairing_required'
  | 'auth_failed';

export type ActivityEventType = 'app_change' | 'heartbeat' | 'hello' | 'pong' | 'user_idle' | 'user_active';

export type ActivityEvent = {
  /** Protocol version — currently always 2. */
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

/** One app's total within a queried window, as answered by the Mac's ledger. */
export type UsageApp = {
  bundleId: string;
  appName: string;
  seconds: number;
  titles: string[];
};

/**
 * How the queried window breaks down. Every field is seconds, and they sum to
 * the window length — so the caller can distinguish "nothing was tracked" from
 * "the Mac was asleep".
 */
export type UsageCoverage = {
  observed: number;
  idle: number;
  locked: number;
  asleep: number;
  /** Time the Mac helper itself was not running. */
  offline: number;
  unknown: number;
};

export type UsageQueryResult = {
  /** Window bounds echoed back, in Mac-clock Unix seconds. */
  from: number;
  to: number;
  apps: UsageApp[];
  coverage: UsageCoverage;
};
