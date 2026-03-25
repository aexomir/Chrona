import { PROJECTS, type Project } from "@/constants/projects";
import { checkAwAvailability } from "@/features/activity-watch/aw-adapter";
import { StaticAuraBackground } from "@/features/aurora/static-aura-background";
import { useCalendarStore } from "@/features/calendar/calendar-store";
import { markOnboardingComplete } from "@/features/onboarding/onboarding-storage";
import { useProjects } from "@/features/projects/projects-store";
import { useSettingsStore } from "@/features/settings/settings-store";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatClock(s: number) {
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

// ─── Slide 0: Welcome — ticking clock, tap anywhere ──────────────────────────

function WelcomeSlide({ onDismiss }: { onDismiss: () => void }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Pressable
      onPress={onDismiss}
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <Text
        style={{
          fontVariant: ["tabular-nums"],
          fontSize: 54,
          fontWeight: "200",
          color: "white",
          letterSpacing: -2,
        }}
      >
        {formatClock(elapsed)}
      </Text>

      <Animated.View
        entering={FadeIn.delay(2000).duration(800)}
        style={{ marginTop: 18 }}
      >
        <Text
          style={{
            color: "rgba(255,255,255,0.35)",
            fontSize: 17,
            letterSpacing: -0.3,
          }}
        >
          Your time is already passing.
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeIn.delay(4000).duration(600)}
        style={{ position: "absolute", bottom: 52 }}
      >
        <Text
          style={{
            color: "rgba(255,255,255,0.18)",
            fontSize: 12,
            letterSpacing: 1,
          }}
        >
          TAP ANYWHERE
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Slide 1: Projects — color mosaic, tap to deselect ───────────────────────

// Alternating wide/narrow: [wide, narrow], [narrow, wide], [wide, narrow]
const MOSAIC_ROWS: [string, string][] = [
  ["work", "study"],
  ["exercise", "creative"],
  ["personal", "rest"],
];
const MOSAIC_RATIOS = [
  [1.55, 1],
  [1, 1.55],
  [1.55, 1],
];

function ProjectTile({
  project,
  selected,
  onToggle,
  flex,
  delay,
}: {
  project: Project;
  selected: boolean;
  onToggle: (id: string) => void;
  flex: number;
  delay: number;
}) {
  const rgb = hexToRgb(project.color);
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: 220 });
  }, [selected, progress]);

  const tileStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(${rgb}, ${0.04 + progress.value * 0.28})`,
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + progress.value * 0.82,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + progress.value * 0.75,
  }));

  return (
    <Animated.View
      entering={FadeIn.delay(delay).duration(350)}
      style={{ flex }}
    >
      <Pressable onPress={() => onToggle(project.id)} style={{ flex: 1 }}>
        <Animated.View
          style={[
            {
              flex: 1,
              borderRadius: 6,
              padding: 12,
            },
            tileStyle,
          ]}
        >
          {/* Icon */}
          <Animated.View style={iconStyle}>
            <Image
              source={`sf:${project.icon}`}
              style={{ width: 22, height: 22, tintColor: project.color }}
            />
          </Animated.View>

          {/* Name */}
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <Animated.Text
              style={[
                {
                  fontSize: 13,
                  fontWeight: "500",
                  letterSpacing: -0.2,
                  color: "white",
                },
                labelStyle,
              ]}
            >
              {project.name}
            </Animated.Text>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function ProjectsSlide({
  selectedIds,
  onToggle,
  onContinue,
}: {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onContinue: () => void;
}) {
  const projectById = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));

  return (
    <View style={{ flex: 1 }}>
      {/* Question */}
      <Animated.View
        entering={FadeIn.duration(350)}
        style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 }}
      >
        <Text
          style={{
            fontSize: 30,
            fontWeight: "600",
            color: "white",
            letterSpacing: -1,
            lineHeight: 36,
          }}
        >
          {"What fills\nyour days?"}
        </Text>
        <Text
          style={{
            marginTop: 6,
            fontSize: 13,
            color: "rgba(255,255,255,0.28)",
            letterSpacing: -0.1,
          }}
        >
          Tap to remove what doesn&apos;t apply.
        </Text>
      </Animated.View>

      {/* Color mosaic */}
      <View style={{ flex: 1, gap: 3, paddingHorizontal: 20 }}>
        {MOSAIC_ROWS.map(([idA, idB], rowIdx) => (
          <View key={rowIdx} style={{ flex: 1, flexDirection: "row", gap: 3 }}>
            <ProjectTile
              project={projectById[idA]}
              selected={selectedIds.has(idA)}
              onToggle={onToggle}
              flex={MOSAIC_RATIOS[rowIdx][0]}
              delay={rowIdx * 80}
            />
            <ProjectTile
              project={projectById[idB]}
              selected={selectedIds.has(idB)}
              onToggle={onToggle}
              flex={MOSAIC_RATIOS[rowIdx][1]}
              delay={rowIdx * 80 + 40}
            />
          </View>
        ))}
      </View>

      {/* Continue */}
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: 8,
          alignItems: "flex-end",
        }}
      >
        {selectedIds.size > 0 ? (
          <Pressable
            onPress={onContinue}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Text
              style={{
                color: "rgba(255,255,255,0.55)",
                fontSize: 14,
                letterSpacing: 0.1,
              }}
            >
              Continue
            </Text>
            <Image
              source="sf:arrow.right"
              style={{
                width: 12,
                height: 12,
                tintColor: "rgba(255,255,255,0.4)",
              }}
            />
          </Pressable>
        ) : (
          <Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>
            Select at least one
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Slide 2: Mac — terminal prompt, auto-check on blur ──────────────────────

type AwStatus = null | "checking" | boolean;

function MacSlide({
  host,
  onHostChange,
  status,
  onCheck,
  onContinue,
}: {
  host: string;
  onHostChange: (v: string) => void;
  status: AwStatus;
  onCheck: () => void;
  onContinue: () => void;
}) {
  const dotColor =
    status === true
      ? "#22c55e"
      : status === false
        ? "#ef4444"
        : status === "checking"
          ? "#f59e0b"
          : "rgba(255,255,255,0.15)";

  const statusLabel =
    status === "checking"
      ? "Checking..."
      : status === true
        ? "Connected"
        : status === false
          ? "Not reachable — is ChronaHelper running?"
          : "";

  return (
    <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
      <Animated.View
        entering={FadeIn.duration(350)}
        style={{ marginBottom: 36 }}
      >
        <Text
          style={{
            fontSize: 32,
            fontWeight: "600",
            color: "white",
            letterSpacing: -1,
            lineHeight: 38,
            marginBottom: 8,
          }}
        >
          {"ChronaHelper\nrunning?"}
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.28)",
            fontSize: 14,
            lineHeight: 20,
          }}
        >
          Install ChronaHelper on your Mac for automatic app tracking.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(200).duration(350)}>
        {/* Terminal-style prompt */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.04)",
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.07)",
            paddingHorizontal: 14,
            paddingVertical: 13,
            gap: 10,
          }}
        >
          <Text
            style={{
              fontFamily: "Courier New",
              color: "rgba(255,255,255,0.2)",
              fontSize: 14,
            }}
          >
            {">"}
          </Text>
          <TextInput
            value={host}
            onChangeText={onHostChange}
            onBlur={onCheck}
            onSubmitEditing={onCheck}
            placeholder="localhost"
            placeholderTextColor="rgba(255,255,255,0.15)"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            style={{
              flex: 1,
              fontFamily: "Courier New",
              fontSize: 15,
              color: "rgba(255,255,255,0.8)",
            }}
          />
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: dotColor,
            }}
          />
        </View>

        {statusLabel.length > 0 && (
          <Animated.Text
            entering={FadeIn.duration(300)}
            style={{
              marginTop: 8,
              marginLeft: 2,
              fontSize: 12,
              color: dotColor,
            }}
          >
            {statusLabel}
          </Animated.Text>
        )}
      </Animated.View>

      <Animated.View
        entering={FadeIn.delay(450).duration(350)}
        style={{
          marginTop: 36,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Pressable onPress={onContinue} hitSlop={10}>
          <Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
            Set up later
          </Text>
        </Pressable>
        <Pressable
          onPress={onContinue}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <Text
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: 14,
              letterSpacing: 0.2,
            }}
          >
            Continue
          </Text>
          <Image
            source="sf:arrow.right"
            style={{
              width: 12,
              height: 12,
              tintColor: "rgba(255,255,255,0.4)",
            }}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Slide 3: Calendar — abstract timeline preview ────────────────────────────

const CALENDAR_BLOCKS = [
  { left: "4%", width: "22%", color: "#3b82f6", label: "9am" },
  { left: "30%", width: "14%", color: "#22c55e", label: "12pm" },
  { left: "48%", width: "28%", color: "#a855f7", label: "1pm" },
  { left: "80%", width: "14%", color: "#f97316", label: "4pm" },
];

function CalendarSlide({
  granted,
  onGrant,
  onContinue,
}: {
  granted: boolean;
  onGrant: () => void;
  onContinue: () => void;
}) {
  return (
    <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
      <Animated.View
        entering={FadeIn.duration(350)}
        style={{ marginBottom: 8 }}
      >
        <Text
          style={{
            fontSize: 32,
            fontWeight: "600",
            color: "white",
            letterSpacing: -1,
            lineHeight: 38,
            marginBottom: 8,
          }}
        >
          {"What's on\ntoday?"}
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.28)",
            fontSize: 14,
            lineHeight: 20,
          }}
        >
          Overlay calendar events on your tracked sessions.
        </Text>
      </Animated.View>

      {/* Abstract timeline */}
      <Animated.View
        entering={FadeIn.delay(200).duration(400)}
        style={{ marginVertical: 28, height: 52, position: "relative" }}
      >
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(255,255,255,0.03)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {/* Hour ticks */}
          {["25%", "50%", "75%"].map((left, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                left,
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: "rgba(255,255,255,0.05)",
              }}
            />
          ))}

          {/* Event blocks — only when granted */}
          {granted &&
            CALENDAR_BLOCKS.map((b, i) => (
              <Animated.View
                key={i}
                entering={FadeIn.delay(i * 120).duration(400)}
                style={{
                  position: "absolute",
                  left: b.left,
                  width: b.width,
                  top: 8,
                  bottom: 8,
                  borderRadius: 5,
                  backgroundColor: b.color + "40",
                  borderLeftWidth: 2,
                  borderLeftColor: b.color,
                  borderRightWidth: 0,
                  borderTopWidth: 0,
                  borderBottomWidth: 0,
                }}
              />
            ))}
        </View>

        {/* Time labels */}
        <Text
          style={{
            position: "absolute",
            left: 4,
            bottom: -18,
            color: "rgba(255,255,255,0.18)",
            fontSize: 10,
          }}
        >
          9am
        </Text>
        <Text
          style={{
            position: "absolute",
            right: 4,
            bottom: -18,
            color: "rgba(255,255,255,0.18)",
            fontSize: 10,
          }}
        >
          6pm
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeIn.delay(400).duration(350)}
        style={{ marginTop: 32, gap: 12 }}
      >
        {granted ? (
          <View style={{ gap: 12 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Image
                source="sf:checkmark.circle.fill"
                style={{ width: 15, height: 15, tintColor: "#22c55e" }}
              />
              <Text style={{ color: "#22c55e", fontSize: 14 }}>
                Calendar connected
              </Text>
            </View>
            <Pressable
              onPress={onContinue}
              style={{
                alignSelf: "flex-end",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Text
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 14,
                  letterSpacing: 0.2,
                }}
              >
                Continue
              </Text>
              <Image
                source="sf:arrow.right"
                style={{
                  width: 12,
                  height: 12,
                  tintColor: "rgba(255,255,255,0.4)",
                }}
              />
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <Pressable
              onPress={onGrant}
              style={{
                paddingVertical: 13,
                backgroundColor: "rgba(255,255,255,0.06)",
                borderRadius: 11,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 15,
                  fontWeight: "500",
                }}
              >
                Connect Calendar
              </Text>
            </Pressable>
            <Pressable onPress={onContinue} style={{ alignItems: "center" }}>
              <Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                Skip
              </Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Slide 4: Ready — concentric rings, single word, full-screen tap ──────────

function ReadySlide({ onFinish }: { onFinish: () => void }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.04, { duration: 2800 }), -1, true);
  }, [pulse]);

  const outerRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  return (
    <Pressable
      onPress={onFinish}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 48,
      }}
    >
      {/* Concentric rings */}
      <Animated.View style={outerRingStyle}>
        <View
          style={{
            width: 160,
            height: 160,
            borderRadius: 80,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 112,
              height: 112,
              borderRadius: 56,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                borderWidth: 1.5,
                borderColor: "rgba(255,255,255,0.2)",
              }}
            />
          </View>
        </View>
      </Animated.View>

      {/* Single word */}
      <Animated.View entering={FadeIn.delay(400).duration(600)}>
        <Text
          style={{
            fontSize: 52,
            fontWeight: "200",
            color: "white",
            letterSpacing: -2,
          }}
        >
          Begin.
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeIn.delay(1200).duration(600)}
        style={{ position: "absolute", bottom: 52 }}
      >
        <Text
          style={{
            color: "rgba(255,255,255,0.15)",
            fontSize: 12,
            letterSpacing: 1,
          }}
        >
          TAP ANYWHERE
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Progress dots ────────────────────────────────────────────────────────────

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            height: 5,
            width: i === current ? 18 : 5,
            borderRadius: 2.5,
            backgroundColor:
              i === current
                ? "rgba(255,255,255,0.65)"
                : "rgba(255,255,255,0.15)",
          }}
        />
      ))}
    </View>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const TOTAL_SLIDES = 5;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Projects
  const { removeProject } = useProjects();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(PROJECTS.map((p) => p.id)),
  );

  const toggleProject = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ChronaHelper
  const { awStreamHost, setAwStreamHost, setAwAdapterMode } =
    useSettingsStore();
  const [localHost, setLocalHost] = useState(awStreamHost);
  const [awStatus, setAwStatus] = useState<AwStatus>(null);

  const checkConnection = async () => {
    const trimmed = localHost.trim() || "localhost";
    setLocalHost(trimmed);
    setAwStreamHost(trimmed);
    if (trimmed !== "localhost") setAwAdapterMode("stream");
    setAwStatus("checking");
    const result = await checkAwAvailability();
    setAwStatus(result);
  };

  // Calendar
  const { permissionStatus, requestPermission } = useCalendarStore();
  const [calGranted, setCalGranted] = useState(permissionStatus === "granted");

  const handleGrantCalendar = async () => {
    await requestPermission();
    setCalGranted(useCalendarStore.getState().permissionStatus === "granted");
  };

  const goNext = () =>
    setCurrentSlide((s) => Math.min(s + 1, TOTAL_SLIDES - 1));

  const handleProjectsContinue = () => {
    PROJECTS.forEach((p) => {
      if (!selectedIds.has(p.id)) removeProject(p.id);
    });
    goNext();
  };

  const handleFinish = () => {
    markOnboardingComplete();
    router.replace("/(tabs)");
  };

  // Slides 0 and 4 are full-screen — no dots shown
  const showDots = currentSlide > 0 && currentSlide < TOTAL_SLIDES - 1;

  return (
    <View style={{ flex: 1, backgroundColor: "#18181b" }}>
      <StaticAuraBackground />

      <View style={{ flex: 1, paddingTop: insets.top }}>
        <Animated.View
          key={currentSlide}
          entering={FadeIn.duration(350)}
          style={{ flex: 1 }}
        >
          {currentSlide === 0 && <WelcomeSlide onDismiss={goNext} />}
          {currentSlide === 1 && (
            <ProjectsSlide
              selectedIds={selectedIds}
              onToggle={toggleProject}
              onContinue={handleProjectsContinue}
            />
          )}
          {currentSlide === 2 && (
            <MacSlide
              host={localHost}
              onHostChange={setLocalHost}
              status={awStatus}
              onCheck={checkConnection}
              onContinue={goNext}
            />
          )}
          {currentSlide === 3 && (
            <CalendarSlide
              granted={calGranted}
              onGrant={handleGrantCalendar}
              onContinue={goNext}
            />
          )}
          {currentSlide === 4 && <ReadySlide onFinish={handleFinish} />}
        </Animated.View>

        {/* Progress dots — only on setup slides */}
        {showDots && (
          <View
            style={{
              alignItems: "center",
              paddingBottom: insets.bottom + 36,
            }}
          >
            <ProgressDots total={TOTAL_SLIDES} current={currentSlide} />
          </View>
        )}
      </View>
    </View>
  );
}
