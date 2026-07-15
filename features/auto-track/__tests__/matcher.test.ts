import type { ActivityEvent } from "@/modules/chrona-stream";

import { matchRule } from "../matcher";
import type { TrackingRule } from "../tracking-rules-store";

function makeEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    version: 1,
    type: "app_change",
    appName: "Xcode",
    windowTitle: "MyProject.xcodeproj",
    bundleId: "com.apple.dt.Xcode",
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeRule(overrides: Partial<TrackingRule> = {}): TrackingRule {
  return {
    id: "rule-1",
    appName: "Xcode",
    titleKeywords: [],
    projectId: "project-1",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("matchRule", () => {
  it("returns null when no rule's appName matches", () => {
    const event = makeEvent({ appName: "Safari" });
    const rules = [makeRule({ appName: "Xcode" })];
    expect(matchRule(event, rules)).toBeNull();
  });

  it("matches an app-only rule (no title keywords) when appName matches", () => {
    const event = makeEvent();
    const rule = makeRule();
    expect(matchRule(event, [rule])).toBe(rule);
  });

  it("matches case-insensitively on appName", () => {
    const event = makeEvent({ appName: "xcode" });
    const rule = makeRule({ appName: "XCODE" });
    expect(matchRule(event, [rule])).toBe(rule);
  });

  it("requires all title keywords to appear in the window title, case-insensitively", () => {
    const event = makeEvent({ windowTitle: "Focus — MyProject.xcodeproj" });
    const rule = makeRule({ titleKeywords: ["focus", "myproject"] });
    expect(matchRule(event, [rule])).toBe(rule);
  });

  it("does not match when any title keyword is missing", () => {
    const event = makeEvent({ windowTitle: "MyProject.xcodeproj" });
    const rule = makeRule({ titleKeywords: ["focus", "myproject"] });
    expect(matchRule(event, [rule])).toBeNull();
  });

  it("ranks the rule with more keywords above a less-specific match", () => {
    const event = makeEvent({ windowTitle: "Focus — MyProject.xcodeproj" });
    const appOnly = makeRule({ id: "app-only", titleKeywords: [] });
    const specific = makeRule({
      id: "specific",
      titleKeywords: ["focus", "myproject"],
    });
    // Order shouldn't matter — specificity wins either way.
    expect(matchRule(event, [appOnly, specific])?.id).toBe("specific");
    expect(matchRule(event, [specific, appOnly])?.id).toBe("specific");
  });

  it("falls back to a less-specific match when the more-specific one's keywords don't all match", () => {
    const event = makeEvent({ windowTitle: "MyProject.xcodeproj" });
    const appOnly = makeRule({ id: "app-only", titleKeywords: [] });
    const specific = makeRule({
      id: "specific",
      titleKeywords: ["focus", "myproject"],
    });
    expect(matchRule(event, [specific, appOnly])?.id).toBe("app-only");
  });

  it("returns null when candidates exist but none satisfy their keywords", () => {
    const event = makeEvent({ windowTitle: "Unrelated Title" });
    const rule = makeRule({ titleKeywords: ["focus"] });
    expect(matchRule(event, [rule])).toBeNull();
  });
});
