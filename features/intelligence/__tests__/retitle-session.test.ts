import { useTrackingRulesStore } from "@/features/auto-track/tracking-rules-store";
import { retitleSession } from "@/features/intelligence/retitle-session";
import { useSessionsStore, type Session } from "@/features/sessions/sessions-store";

import { promptOf, reply, useFakeModel } from "./fake-model";

jest.mock("@/lib/sentry", () => ({ captureError: jest.fn() }));

const doGenerate = useFakeModel();

const autoSession: Session = {
  id: "s1",
  title: "Xcode",
  projectId: "p1",
  startTime: "2026-10-12T09:00:00.000Z",
  endTime: "2026-10-12T10:00:00.000Z",
  duration: 3600,
  auto: true,
  apps: [
    { app: "Safari", duration: 600, titles: ["Swift Concurrency — Safari"] },
    { app: "Xcode", duration: 3000, titles: ["Chrona — TimerBar.swift", "Xcode"] },
  ],
};

function givenSession(patch: Partial<Session> = {}) {
  useSessionsStore.setState({ sessions: [{ ...autoSession, ...patch }] });
}

const currentTitle = () => useSessionsStore.getState().sessions[0].title;

beforeEach(() => {
  givenSession();
  useTrackingRulesStore.setState({ rules: [] });
});

it("renames an auto session that still has the app name as its title", async () => {
  doGenerate.mockResolvedValue(reply({ title: "Timer bar refactor" }));

  await retitleSession("s1");

  expect(currentTitle()).toBe("Timer bar refactor");
});

it("sends the busiest app's window titles first, without app-name noise", async () => {
  doGenerate.mockResolvedValue(reply({ title: "Timer bar refactor" }));

  await retitleSession("s1");

  const prompt = promptOf(doGenerate);
  expect(prompt.indexOf("Xcode, 50 min")).toBeLessThan(prompt.indexOf("Safari, 10 min"));
  expect(prompt).toContain("- Chrona — TimerBar.swift");
  expect(prompt).toMatch(/^- Swift Concurrency$/m);
  expect(prompt).not.toContain("- Xcode");
});

it("treats a rule's default title as a placeholder", async () => {
  givenSession({ title: "Deep work" });
  useTrackingRulesStore.setState({
    rules: [
      {
        id: "r1",
        appName: "Xcode",
        titleKeywords: [],
        projectId: "p1",
        defaultTitle: "Deep work",
        createdAt: "2026-10-01T00:00:00.000Z",
      },
    ],
  });
  doGenerate.mockResolvedValue(reply({ title: "Timer bar refactor" }));

  await retitleSession("s1");

  expect(currentTitle()).toBe("Timer bar refactor");
});

it("tidies quotes and trailing punctuation", async () => {
  doGenerate.mockResolvedValue(reply({ title: '"Timer bar refactor."' }));

  await retitleSession("s1");

  expect(currentTitle()).toBe("Timer bar refactor");
});

it("rejects a title longer than five words", async () => {
  doGenerate.mockResolvedValue(reply({ title: "One two three four five six" }));

  await retitleSession("s1");

  expect(currentTitle()).toBe("Xcode");
});

it.each([
  ["a title the user wrote", { title: "Planning the week" }],
  ["a manual session", { auto: false }],
  ["a session without window titles", { apps: [{ app: "Xcode", duration: 3000 }] }],
])("leaves %s alone without asking the model", async (_, patch) => {
  givenSession(patch);

  await retitleSession("s1");

  expect(doGenerate).not.toHaveBeenCalled();
});

it("keeps a title the user changed while the model was answering", async () => {
  doGenerate.mockImplementation(async () => {
    givenSession({ title: "Typed meanwhile" });
    return reply({ title: "Timer bar refactor" });
  });

  await retitleSession("s1");

  expect(currentTitle()).toBe("Typed meanwhile");
});
