import type { Project } from "@/constants/projects";
import { suggestProject } from "@/features/timer/suggest-project";

import { promptOf, reply, useFakeModel } from "@/features/intelligence/__tests__/fake-model";

jest.mock("@/lib/sentry", () => ({ captureError: jest.fn() }));

const doGenerate = useFakeModel();

const projects = [
  { id: "p-writing", name: "Writing" },
  { id: "p-chrona", name: "Chrona" },
] as Project[];

it("returns the project the model picks", async () => {
  doGenerate.mockResolvedValue(reply({ projectId: "p-chrona" }));

  await expect(suggestProject("Fix the timer bar", projects)).resolves.toBe("p-chrona");
  expect(promptOf(doGenerate)).toContain("- p-chrona: Chrona");
});

it("limits the answer to the user's project ids plus none", async () => {
  doGenerate.mockResolvedValue(reply({ projectId: "none" }));

  await suggestProject("Lunch", projects);

  expect(doGenerate.mock.calls[0][0]).toMatchObject({
    responseFormat: {
      schema: { properties: { projectId: { enum: ["p-writing", "p-chrona", "none"] } } },
    },
  });
});

it("returns null when the model says none fits", async () => {
  doGenerate.mockResolvedValue(reply({ projectId: "none" }));

  await expect(suggestProject("Lunch", projects)).resolves.toBeNull();
});

it("returns null without asking when there is no title or no project", async () => {
  await expect(suggestProject("   ", projects)).resolves.toBeNull();
  await expect(suggestProject("Fix the timer bar", [])).resolves.toBeNull();
  expect(doGenerate).not.toHaveBeenCalled();
});
