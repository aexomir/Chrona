import type { ActivityEvent } from '@/modules/chrona-stream';

import type { TrackingRule } from './tracking-rules-store';

/**
 * Pure function — no side effects, no store access.
 *
 * Given an activity event and the current rule list, returns the best-matching
 * rule or null. App name must match exactly (case-insensitive). All title
 * keywords must appear in the window title (case-insensitive). Rules with more
 * keywords rank above app-only rules so the most-specific match wins.
 */
export function matchRule(
  event: ActivityEvent,
  rules: TrackingRule[],
): TrackingRule | null {
  const appLower = event.appName.toLowerCase();
  const titleLower = event.windowTitle.toLowerCase();

  const candidates = rules.filter(
    (r) => r.appName.toLowerCase() === appLower,
  );

  // Most-specific first: more keywords → higher priority
  const sorted = [...candidates].sort(
    (a, b) => b.titleKeywords.length - a.titleKeywords.length,
  );

  for (const rule of sorted) {
    // App-only rule (no keywords) always matches when appName matches
    if (rule.titleKeywords.length === 0) return rule;

    const allMatch = rule.titleKeywords.every((kw) =>
      titleLower.includes(kw.toLowerCase()),
    );
    if (allMatch) return rule;
  }

  return null;
}
