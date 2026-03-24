import { StaticAuraBackground } from "@/features/aurora/static-aura-background";
import { useAuroraTheme } from "@/features/aurora/use-aurora-theme";
import {
  useSettingsStore,
  type TimerStartMode,
} from "@/features/settings/settings-store";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── mode definitions ────────────────────────────────────────────

type ModeConfig = {
  id: TimerStartMode;
  name: string;
  label: string;
  description: string;
  Preview: () => React.JSX.Element;
};

const MODES: ModeConfig[] = [
  {
    id: "a",
    name: "Conversational",
    label: "Just type and begin",
    description:
      "A bare text input with no borders — just a cursor on the surface. Project chips let you tag the session without leaving the flow.",
    Preview: PreviewConversational,
  },
  {
    id: "b",
    name: "Hold to Start",
    label: "Commit with your hands",
    description:
      "Press and hold a ring to start the timer. The physical act of holding mirrors the mental act of committing to focus.",
    Preview: PreviewHold,
  },
  {
    id: "c",
    name: "Project First",
    label: "Choose context, then intent",
    description:
      "Pick the project before naming the session. Two intentional micro-decisions that prime you for what you're about to do.",
    Preview: PreviewProjectFirst,
  },
];

// ─── screen ──────────────────────────────────────────────────────

export default function TimerStyleScreen() {
  const theme = useAuroraTheme();
  const insets = useSafeAreaInsets();
  const { timerStartMode, setTimerStartMode } = useSettingsStore();

  const handleSelect = (id: TimerStartMode) => {
    setTimerStartMode(id);
    router.back();
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <StaticAuraBackground />

      {/* Nav bar */}
      <View style={styles.nav}>
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.navCancel}>Cancel</Text>
          </Pressable>
        </View>
        <Text style={styles.navTitle}>Timer Style</Text>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>
          Choose how you start a focus session
        </Text>

        <View style={{ gap: 14 }}>
          {MODES.map((mode, i) => {
            const isSelected = timerStartMode === mode.id;
            return (
              <Animated.View
                key={mode.id}
                entering={FadeInDown.delay(i * 75).duration(300)}
              >
                <Pressable
                  onPress={() => handleSelect(mode.id)}
                  style={[
                    styles.card,
                    {
                      borderColor: isSelected
                        ? "rgba(255,255,255,0.22)"
                        : theme.cardBorder,
                      backgroundColor: isSelected
                        ? "rgba(255,255,255,0.05)"
                        : theme.card,
                    },
                  ]}
                >
                  {/* Header row */}
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text
                        style={[
                          styles.modeName,
                          { color: isSelected ? "#fff" : "rgba(255,255,255,0.7)" },
                        ]}
                      >
                        {mode.name}
                      </Text>
                      <Text style={styles.modeLabel}>{mode.label}</Text>
                    </View>
                    {isSelected ? (
                      <Image
                        source="sf:checkmark.circle.fill"
                        style={{ width: 20, height: 20, tintColor: "#fff" }}
                      />
                    ) : (
                      <View style={styles.emptyCheck} />
                    )}
                  </View>

                  {/* Preview */}
                  <View style={styles.preview}>
                    <mode.Preview />
                  </View>

                  {/* Description */}
                  <Text style={styles.description}>{mode.description}</Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── previews ────────────────────────────────────────────────────

function PreviewConversational() {
  return (
    <View style={{ gap: 18 }}>
      {/* Bare input */}
      <View style={{ gap: 8 }}>
        <Text style={previewStyles.eyebrow}>what are you focusing on?</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 2 }}>
          <Text style={previewStyles.inputText}>deep work</Text>
          <View style={previewStyles.cursor} />
        </View>
        <View style={previewStyles.inputLine} />
      </View>

      {/* Project chips */}
      <View style={{ flexDirection: "row", gap: 7, flexWrap: "wrap" }}>
        <View style={[previewStyles.chip, { borderColor: "rgba(255,255,255,0.1)" }]}>
          <Text style={[previewStyles.chipText, { color: "rgba(255,255,255,0.25)" }]}>
            No project
          </Text>
        </View>
        <View style={[previewStyles.chip, { borderColor: "#60a5fa50", backgroundColor: "#60a5fa0f" }]}>
          <View style={[previewStyles.chipDot, { backgroundColor: "#60a5fa" }]} />
          <Text style={[previewStyles.chipText, { color: "#60a5fa" }]}>Work</Text>
        </View>
        <View style={[previewStyles.chip, { borderColor: "#a78bfa40", backgroundColor: "#a78bfa0a" }]}>
          <View style={[previewStyles.chipDot, { backgroundColor: "#a78bfa" }]} />
          <Text style={[previewStyles.chipText, { color: "rgba(255,255,255,0.3)" }]}>Design</Text>
        </View>
        <View style={[previewStyles.chip, { borderColor: "rgba(255,255,255,0.08)" }]}>
          <Text style={[previewStyles.chipText, { color: "rgba(255,255,255,0.2)" }]}>Health</Text>
        </View>
      </View>

      {/* Begin button ghost */}
      <View style={previewStyles.beginButton}>
        <Text style={previewStyles.beginText}>Begin</Text>
      </View>
    </View>
  );
}

function PreviewHold() {
  const r = 36;
  const circumference = 2 * Math.PI * r;
  return (
    <View style={{ gap: 14 }}>
      {/* Input ghost */}
      <View style={previewStyles.inputGhost} />

      {/* Ring */}
      <View style={{ alignItems: "center", gap: 8, paddingVertical: 6 }}>
        <Svg width={96} height={96}>
          <Circle
            cx={48}
            cy={48}
            r={r}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={2.5}
            fill="none"
          />
          <Circle
            cx={48}
            cy={48}
            r={r}
            stroke="rgba(255,255,255,0.5)"
            strokeWidth={2.5}
            fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={`${circumference * 0.42}`}
            strokeLinecap="round"
            rotation={-90}
            origin="48, 48"
          />
        </Svg>
        <Text style={previewStyles.eyebrow}>hold to begin</Text>
      </View>
    </View>
  );
}

function PreviewProjectFirst() {
  const rows = [
    { color: "#60a5fa", name: "Work" },
    { color: "#a78bfa", name: "Design" },
    { color: "#34d399", name: "Health" },
  ];
  return (
    <View style={{ gap: 10 }}>
      <Text style={previewStyles.eyebrow}>what are you working on?</Text>
      <View style={{ gap: 6 }}>
        {rows.map((row, i) => (
          <View
            key={row.name}
            style={[
              previewStyles.projectRow,
              {
                backgroundColor: row.color + "12",
                borderColor: row.color + "28",
                opacity: i === 0 ? 1 : i === 1 ? 0.7 : 0.45,
              },
            ]}
          >
            <View style={[previewStyles.projectDot, { backgroundColor: row.color }]} />
            <Text style={previewStyles.projectName}>{row.name}</Text>
            <Image
              source="sf:chevron.right"
              style={{ width: 10, height: 10, tintColor: row.color + "60" }}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  navCancel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 16,
  },
  navTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  sectionLabel: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    letterSpacing: 0.2,
    marginBottom: 16,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  modeName: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  modeLabel: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
  },
  emptyCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  preview: {
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 18,
  },
  description: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
    lineHeight: 20,
  },
});

const previewStyles = StyleSheet.create({
  eyebrow: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  inputText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  cursor: {
    width: 1.5,
    height: 17,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 1,
  },
  inputLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  inputGhost: {
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "500",
  },
  beginButton: {
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingVertical: 10,
    alignItems: "center",
  },
  beginText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    fontWeight: "600",
  },
  projectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  projectDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  projectName: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    flex: 1,
  },
});
