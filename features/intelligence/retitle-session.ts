/**
 * Replaces an auto session's placeholder title — the rule's default title or
 * the app name — with one drawn from the window titles the Mac recorded.
 *
 * Fire and forget. Runs after the session is saved, never blocks saving, and
 * leaves the title alone if anything (usually the user) changed it while the
 * model was thinking.
 */

import { useTrackingRulesStore } from "@/features/auto-track/tracking-rules-store";
import { generate } from "@/features/intelligence/on-device-model";
import { useSessionsStore, type Session } from "@/features/sessions/sessions-store";
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

function cleanWindowTitle(title: string, app: string): string {
  const appName = escapeRegExp(app);
  return title
    .replace(new RegExp(`\\s*[-–—|·:]\\s*${appName}\\s*$`, "i"), "")
    .replace(new RegExp(`^\\s*${appName}\\s*[-–—|·:]\\s*`, "i"), "")
    .trim()
    .slice(0, MAX_TITLE_CHARS);
}

function buildPrompt(session: Session): string | null {
  const blocks = [...(session.apps ?? [])]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, TOP_APPS)
    .map((a) => {
      const titles = [
        ...new Set(
          (a.titles ?? [])
            .map((t) => cleanWindowTitle(t, a.app))
            .filter((t) => t && t.toLowerCase() !== a.app.toLowerCase()),
        ),
      ].slice(0, TITLES_PER_APP);
      if (titles.length === 0) return null;
      return `${a.app}, ${Math.round(a.duration / 60)} min:\n${titles.map((t) => `- ${t}`).join("\n")}`;
    })
    .filter((block) => block !== null);

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
