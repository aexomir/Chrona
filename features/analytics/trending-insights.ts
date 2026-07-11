import type { Session } from '@/features/sessions/sessions-store';
import type { Project } from '@/constants/projects';
import { formatHourLabel } from '@/features/analytics/stats-utils';

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
        color: '#3b82f6',
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
      color: '#8b5cf6',
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
      color: '#f59e0b',
      suggestedQuery: `How's my focus streak?`,
    });
  }

  return insights.slice(0, 3);
}

/**
 * Compute current focus streak from session data.
 */
function computeStreak(sessions: Session[]): { current: number; best: number } {
  if (sessions.length === 0) return { current: 0, best: 0 };

  const sessionDates = new Set<string>();
  for (const session of sessions) {
    const date = new Date(session.startTime).toDateString();
    sessionDates.add(date);
  }

  const sortedDates = Array.from(sessionDates)
    .map((d) => new Date(d).getTime())
    .sort((a, b) => b - a);

  let currentStreak = 0;
  let bestStreak = 0;
  let lastDate = new Date().toDateString();

  for (const timestamp of sortedDates) {
    const date = new Date(timestamp).toDateString();
    const lastTime = new Date(lastDate).getTime();
    const currentTime = new Date(date).getTime();
    const daysDiff = Math.round((lastTime - currentTime) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 1) {
      currentStreak++;
    } else {
      break;
    }
    lastDate = date;
  }

  bestStreak = currentStreak;
  for (let i = 0; i < sortedDates.length - 1; i++) {
    let tempStreak = 1;
    for (let j = i; j < sortedDates.length - 1; j++) {
      const daysDiff = Math.round(
        (sortedDates[j] - sortedDates[j + 1]) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff === 1) {
        tempStreak++;
      } else {
        break;
      }
    }
    bestStreak = Math.max(bestStreak, tempStreak);
  }

  return { current: currentStreak, best: bestStreak };
}
