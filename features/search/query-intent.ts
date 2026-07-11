/**
 * Shared keyword-based intent detection for search queries.
 * Consolidates the streak/project checks that were previously duplicated
 * verbatim across use-search-query.ts and search-generation.ts.
 */

function matchesAny(query: string, keywords: string[]): boolean {
  return keywords.some((keyword) => query.includes(keyword));
}

export function isStreakIntent(lowerQuery: string): boolean {
  return matchesAny(lowerQuery, ["streak", "consistency", "consecutive"]);
}

export function isProjectIntent(lowerQuery: string): boolean {
  return matchesAny(lowerQuery, ["project", "which"]);
}

export function isStatsIntent(lowerQuery: string): boolean {
  return matchesAny(lowerQuery, ["stat", "how much", "total"]);
}
