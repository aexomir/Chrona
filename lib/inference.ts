import * as z from 'zod/v4';
import type { Session } from '@/stores/sessions-store';
import type { Project } from '@/constants/projects';

// ──── Schemas ────────────────────────────────────────────────────────────

export const InsightSchema = z.object({
  headline: z.string().max(60),
  body: z.string().max(200),
  tip: z.string().max(120).optional(),
  sentiment: z.enum(['positive', 'neutral', 'cautionary']),
});

export type Insight = z.infer<typeof InsightSchema>;

export const SearchResultSchema = z.object({
  headline: z.string().max(60),
  body: z.string().max(200),
  tip: z.string().max(120).optional(),
  sentiment: z.enum(['positive', 'neutral', 'cautionary']),
  show_timeline: z.boolean(),
  show_metrics: z.boolean(),
  show_chart: z.boolean(),
  show_projects: z.boolean(),
  show_streak: z.boolean(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

// ──── Session Serialization ────────────────────────────────────────────

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getDayMonthString(isoString: string): string {
  const date = new Date(isoString);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function serializeSessions(sessions: Session[], projects: Project[]): string {
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const limited = sessions.slice(0, 20);

  const lines = limited.map((session) => {
    const date = getDayMonthString(session.startTime);
    const time = formatTime(session.startTime);
    const duration = formatDuration(session.duration);
    const projectName = session.projectId ? projectMap.get(session.projectId) || 'Unknown' : 'Unassigned';
    const apps = session.apps?.length
      ? session.apps
          .slice(0, 3)
          .map((a) => a.app)
          .join(', ')
      : '';
    const appsStr = apps ? ` (${apps})` : '';
    return `${date}, ${time}, ${duration}, ${projectName}${appsStr}`;
  });

  return lines.join('\n');
}

// ──── Fingerprint ────────────────────────────────────────────────────────

export function computeFingerprint(sessionIds: string[]): string {
  const sorted = [...sessionIds].sort();
  const combined = sorted.join('|');
  // Simple stable hash: convert chars to numeric codes and combine
  let hash = '';
  for (let i = 0; i < combined.length; i++) {
    hash += combined.charCodeAt(i).toString(16);
  }
  return hash.slice(0, 64);
}

// ──── System Prompts ───────────────────────────────────────────────────

export function buildInsightSystemPrompt(): string {
  return `You are an AI coach providing actionable insights about productivity patterns.
Analyze focus session data and provide personalized, encouraging insights.
Respond with a JSON object containing: headline (max 60 chars), body (max 200 chars), optional tip (max 120 chars), and sentiment (positive/neutral/cautionary).`;
}

// ──── User Messages ────────────────────────────────────────────────────

export function buildInsightUserMessage(
  sessions: Session[],
  projects: Project[],
  timeframeLabel: string
): string {
  const serialized = serializeSessions(sessions, projects);
  return `Analyze these ${timeframeLabel} focus sessions and provide an insight:

${serialized}

Provide a structured JSON response.`;
}

export function buildSearchSystemPrompt(): string {
  return `You are an AI assistant analyzing user focus session data to answer natural language questions.
Based on the focus sessions provided, determine which visualizations best answer the user's question.
Respond with a JSON object containing: headline, body, optional tip, sentiment, and boolean flags for which components to show (show_timeline, show_metrics, show_chart, show_projects, show_streak).
Be concise and insightful.`;
}

export function buildSearchUserMessage(
  query: string,
  sessions: Session[],
  projects: Project[]
): string {
  const serialized = serializeSessions(sessions, projects);
  return `User question: "${query}"

Focus sessions data:
${serialized}

Answer the question by analyzing the sessions. Provide a JSON response with headline, body, optional tip, sentiment, and boolean flags for visualization components.`;
}

export function parseQueryTimeframe(query: string): 'today' | 'week' | 'month' | 'all' {
  const lowerQuery = query.toLowerCase();
  if (lowerQuery.includes('today') || lowerQuery.includes('today')) return 'today';
  if (lowerQuery.includes('week') || lowerQuery.includes('this week')) return 'week';
  if (lowerQuery.includes('month') || lowerQuery.includes('this month')) return 'month';
  return 'week'; // default to week
}
