/**
 * Replaces an auto session's placeholder title (the rule's default title or the
 * app name) with one drawn from the window titles the Mac recorded.
 *
 * Fire and forget: it runs after the session is saved, and leaves the title
 * alone if it changed while the model was thinking.
 */

import { useTrackingRulesStore } from "@/features/auto-track/tracking-rules-store";
import { generate } from "@/features/intelligence/on-device-model";
import { useSessionsStore, type AppUsage, type Session } from "@/features/sessions/sessions-store";
import { captureError } from "@/lib/sentry";
import { z } from "zod";

const MAX_WORDS = 5;
const TOP_APPS = 3;
const TITLES_PER_APP = 8;
const MAX_TITLE_CHARS = 80;

const titleSchema = z.object({
  title: z.string().describe(`A session title of at most ${MAX_WORDS} words`),
});

const SYSTEM = `You name focus sessions in a time-tracking app from the window titles that were open.
Reply with a title of at most ${MAX_WORDS} words describing what the person worked on.
Prefer the document, project, page or topic over the app.
Leave out app names, browser names, file extensions and words like "untitled".
Use sentence case. No quotes, no emoji, no trailing punctuation.`;

function hasDefaultTitle(session: Session): boolean {
  const title = session.title.trim().toLowerCase();
  if (session.apps?.some((a) => a.app.toLowerCase() === title)) return true;
  return useTrackingRulesStore
    .getState()
    .rules.some(
      (r) =>
        r.appName.toLowerCase() === title ||
        r.defaultTitle?.trim().toLowerCase() === title,
    );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "Notes.md — Visual Studio Code" → "Notes.md" */
function stripAppName(title: string, app: string): string {
  const name = escapeRegExp(app);
  return title
    .replace(new RegExp(`\\s*[-–—|·:]\\s*${name}\\s*$`, "i"), "")
    .replace(new RegExp(`^\\s*${name}\\s*[-–—|·:]\\s*`, "i"), "")
    .trim()
    .slice(0, MAX_TITLE_CHARS);
}

function windowTitles(usage: AppUsage): string[] {
  const cleaned = (usage.titles ?? [])
    .map((t) => stripAppName(t, usage.app))
    .filter((t) => t && t.toLowerCase() !== usage.app.toLowerCase());
  return [...new Set(cleaned)].slice(0, TITLES_PER_APP);
}

function buildPrompt(session: Session): string | null {
  const busiest = [...(session.apps ?? [])]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, TOP_APPS);

  const blocks: string[] = [];
  for (const usage of busiest) {
    const titles = windowTitles(usage);
    if (titles.length === 0) continue;
    const minutes = Math.round(usage.duration / 60);
    blocks.push(`${usage.app}, ${minutes} min:\n${titles.map((t) => `- ${t}`).join("\n")}`);
  }

  if (blocks.length === 0) return null;
  return `Window titles, busiest app first:\n\n${blocks.join("\n\n")}`;
}

function normalizeTitle(raw: string): string | null {
  const title = raw
    .trim()
    .replace(/^["'“‘]+|["'”’]+$/g, "")
    .replace(/[.!?:;,]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) return null;
  if (title.split(" ").length > MAX_WORDS) return null;
  return title;
}

export async function retitleSession(id: string): Promise<void> {
  try {
    const session = useSessionsStore.getState().sessions.find((s) => s.id === id);
    if (!session?.auto || !hasDefaultTitle(session)) return;

    const prompt = buildPrompt(session);
    if (!prompt) return;

    const result = await generate(titleSchema, prompt, SYSTEM);
    const title = result ? normalizeTitle(result.title) : null;
    if (!title || title.toLowerCase() === session.title.trim().toLowerCase()) return;

    const latest = useSessionsStore.getState().sessions.find((s) => s.id === id);
    if (!latest || latest.title !== session.title) return;

    useSessionsStore.getState().updateSession({ ...latest, title });
  } catch (error) {
    captureError(error, "retitle_session");
  }
}
