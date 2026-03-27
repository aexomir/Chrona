/**
 * Centralized timing thresholds for the auto-tracking feature.
 *
 * Change values here to test different time windows — no other file changes needed.
 * Hot-reload picks up changes automatically during development.
 *
 * Production values:
 *   IDLE_TIMEOUT_MS         = 2 * 60 * 1000   (2 minutes)
 *   UNTRACKED_THRESHOLD_MS  = 10 * 60 * 1000  (10 minutes)
 */

export const IDLE_TIMEOUT_MS = 2 * 60 * 1000;
export const UNTRACKED_THRESHOLD_MS = 10 * 60 * 1000;
