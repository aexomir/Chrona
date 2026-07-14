import { Semantic } from '@/constants/theme';
import type { Project } from '@/constants/projects';
import { computeStreak, formatHourLabel } from '@/features/analytics/stats-utils';
import type { Session } from '@/features/sessions/sessions-store';

export interface TrendingInsight {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  suggestedQuery: string;
}

/**
 * Analyze session data and generate trending insights.
 * Returns up to 3 most interesting patterns.
 */
export function generateTrendingInsights(
  sessions: Session[],
  projects: Project[]
): TrendingInsight[] {
  if (sessions.length === 0) return [];

  const insights: TrendingInsight[] = [];
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  // Insight 1: Dominant project (if >40% of time)
  const projectTotals = new Map<string, number>();
  for (const session of sessions) {
    const projectId = session.projectId || 'unassigned';
    projectTotals.set(projectId, (projectTotals.get(projectId) || 0) + session.duration);
  }

  const totalDuration = Array.from(projectTotals.values()).reduce((a, b) => a + b, 0);
  const dominantProject = Array.from(projectTotals.entries())
    .sort((a, b) => b[1] - a[1])[0];

  if (dominantProject) {
    const percentage = Math.round((dominantProject[1] / totalDuration) * 100);
    if (percentage > 40) {
      const projectName = dominantProject[0] === 'unassigned'
        ? 'Unassigned'
        : projectMap.get(dominantProject[0]) || 'Unknown';

      insights.push({
        id: 'dominant-project',
        title: `${projectName} Focused`,
        subtitle: `${percentage}% of your time this week`,
        icon: 'sf:folder.fill',
        color: Semantic.info,
        suggestedQuery: `Projects this week`,
      });
    }
  }

  // Insight 2: Peak activity hour
  const hourBuckets = new Map<number, number>();
  for (const session of sessions) {
    const hour = new Date(session.startTime).getHours();
    hourBuckets.set(hour, (hourBuckets.get(hour) || 0) + session.duration);
  }

  const peakHour = Array.from(hourBuckets.entries())
    .sort((a, b) => b[1] - a[1])[0];

  if (peakHour && peakHour[1] > 0) {
    const [hour] = peakHour;
    const timeStr = formatHourLabel(hour);

    insights.push({
      id: 'peak-hour',
      title: 'Peak Focus Hour',
      subtitle: `You're most focused around ${timeStr}`,
      icon: 'sf:clock.fill',
      color: Semantic.insight,
      suggestedQuery: `When do I focus most?`,
    });
  }

  // Insight 3: Streak status (if >= 3 days)
  const streak = computeStreak(sessions);
  if (streak.current >= 3) {
    insights.push({
      id: 'streak-status',
      title: '🔥 Streak Active',
      subtitle: `${streak.current} days focused in a row`,
      icon: 'sf:flame.fill',
      color: Semantic.warning,
      suggestedQuery: `How's my focus streak?`,
    });
  }

  return insights.slice(0, 3);
}
