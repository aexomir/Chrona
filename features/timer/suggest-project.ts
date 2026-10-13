import type { Project } from "@/constants/projects";
import { generate } from "@/features/intelligence/on-device-model";
import { z } from "zod";

const MAX_PROJECTS = 30;

const SYSTEM = `You file focus sessions under the user's projects in a time-tracking app.
Given a session title and the list of projects, reply with the id of the project it most likely belongs to.
Reply "none" when no project is a clear fit. Don't guess.`;

export async function suggestProject(
  text: string,
  projects: Project[],
): Promise<string | null> {
  const title = text.trim();
  const candidates = projects.slice(0, MAX_PROJECTS);
  if (!title || candidates.length === 0) return null;

  const [first, ...rest] = candidates.map((p) => p.id);
  const schema = z.object({ projectId: z.enum([first, ...rest, "none"]) });
  const list = candidates.map((p) => `- ${p.id}: ${p.name}`).join("\n");

  const result = await generate(
    schema,
    `Session title: ${title}\n\nProjects (id: name):\n${list}`,
    SYSTEM,
  );
  if (!result || result.projectId === "none") return null;
  return candidates.some((p) => p.id === result.projectId) ? result.projectId : null;
}
