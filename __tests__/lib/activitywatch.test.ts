import {
  getAppCategory,
  checkAwAvailability,
  APP_CATEGORIES,
} from "@/lib/activitywatch";

jest.mock("react-native-mmkv");
jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock")
);

// ---------------------------------------------------------------------------
// getAppCategory
// ---------------------------------------------------------------------------

describe("getAppCategory", () => {
  it("is case-insensitive", () => {
    expect(getAppCategory("Safari")).toBe("browser");
    expect(getAppCategory("SAFARI")).toBe("browser");
    expect(getAppCategory("safari")).toBe("browser");
  });

  it("returns correct category for browsers", () => {
    const browsers = ["chrome", "safari", "arc", "firefox", "vivaldi", "opera", "microsoft edge", "brave browser"];
    for (const b of browsers) {
      expect(getAppCategory(b)).toBe("browser");
    }
  });

  it("returns correct category for IDEs", () => {
    const ides = ["cursor", "xcode", "code", "webstorm", "intellij idea", "pycharm", "zed", "nova"];
    for (const ide of ides) {
      expect(getAppCategory(ide)).toBe("ide");
    }
  });

  it("returns correct category for terminals", () => {
    const terminals = ["iterm2", "terminal", "warp", "alacritty", "kitty"];
    for (const t of terminals) {
      expect(getAppCategory(t)).toBe("terminal");
    }
  });

  it("returns correct category for communication apps", () => {
    const comm = ["slack", "discord", "telegram", "messages", "mail", "outlook"];
    for (const c of comm) {
      expect(getAppCategory(c)).toBe("communication");
    }
  });

  it("returns correct category for meeting apps", () => {
    const meetings = ["zoom", "facetime", "around"];
    for (const m of meetings) {
      expect(getAppCategory(m)).toBe("meeting");
    }
  });

  it("returns correct category for design apps", () => {
    expect(getAppCategory("figma")).toBe("design");
    expect(getAppCategory("sketch")).toBe("design");
  });

  it("returns correct category for productivity apps", () => {
    expect(getAppCategory("notion")).toBe("productivity");
    expect(getAppCategory("obsidian")).toBe("productivity");
    expect(getAppCategory("linear")).toBe("productivity");
  });

  it("returns correct category for media apps", () => {
    expect(getAppCategory("spotify")).toBe("media");
    expect(getAppCategory("logic pro")).toBe("media");
  });

  it("returns null for unknown apps", () => {
    expect(getAppCategory("MyCustomApp")).toBeNull();
    expect(getAppCategory("xterm")).toBeNull();
    expect(getAppCategory("")).toBeNull();
    expect(getAppCategory("preview")).toBeNull();
  });

  it("APP_CATEGORIES has no uppercase keys (all lookups must be lowercase)", () => {
    const keys = Object.keys(APP_CATEGORIES);
    for (const k of keys) {
      expect(k).toBe(k.toLowerCase());
    }
  });
});

// ---------------------------------------------------------------------------
// checkAwAvailability
// ---------------------------------------------------------------------------

describe("checkAwAvailability", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns true when AW has a window watcher bucket", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        "aw-watcher-window_mymac": { id: "aw-watcher-window_mymac" },
        "aw-watcher-afk_mymac": { id: "aw-watcher-afk_mymac" },
      }),
    });
    expect(await checkAwAvailability()).toBe(true);
  });

  it("returns false when AW is running but has no window bucket", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        "aw-watcher-afk_mymac": { id: "aw-watcher-afk_mymac" },
      }),
    });
    expect(await checkAwAvailability()).toBe(false);
  });

  it("returns false when AW fetch fails with network error", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("ECONNREFUSED")
    );
    expect(await checkAwAvailability()).toBe(false);
  });

  it("returns false when AW responds with non-ok HTTP status", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
    expect(await checkAwAvailability()).toBe(false);
  });

  it("returns false when AW responds with empty bucket list", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    expect(await checkAwAvailability()).toBe(false);
  });
});
