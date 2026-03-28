import type { Project } from "@/constants/projects";
import { StaticAuraBackground } from "@/features/aurora/static-aura-background";
import { useAuroraTheme } from "@/features/aurora/use-aurora-theme";
import { useProjects } from "@/features/projects/projects-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { useSettingsStore } from "@/features/settings/settings-store";
import { getAppsForWindow, markTimerStart } from "@/features/intelligence/journal-store";
import { useAppToast } from "@/hooks/use-app-toast";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Input, PortalHost, Select } from "heroui-native";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SelectOption = { value: string; label: string };
type StartMode = "a" | "b" | "c";

const HOLD_R = 72;
const HOLD_CIRCUMFERENCE = 2 * Math.PI * HOLD_R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const styles = StyleSheet.create({
  titleInput: {
    fontSize: 26,
    color: "#ffffff",
    letterSpacing: -0.5,
    paddingVertical: 8,
    fontWeight: "600",
  },
  elapsed: {
    fontSize: 72,
    lineHeight: 80,
    letterSpacing: -2,
  },
  dotIndicator: {
    height: 6,
  },
});

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function TimerScreen() {
  const { projects } = useProjects();
  const {
    isTracking,
    title,
    projectId,
    startTimestamp,
    startTimer,
    stopTimer,
    updateTitle,
    updateProjectId,
  } = useTimerStore();
  const { addSession } = useSessionsStore();
  const toast = useAppToast();
  const insets = useSafeAreaInsets();
  const { suggestProjectId, suggestEventTitle } = useLocalSearchParams<{
    suggestProjectId?: string;
    suggestEventTitle?: string;
  }>();

  const [taskTitle, setTaskTitle] = useState<string>(() => {
    if (title) return title;
    if (suggestEventTitle) return decodeURIComponent(suggestEventTitle);
    return "";
  });
  const [selectedProject, setSelectedProject] = useState<
    SelectOption | undefined
  >(() => {
    const projId = suggestProjectId || projectId;
    if (!projId) return undefined;
    const proj = projects.find((p) => p.id === projId);
    return proj ? { value: proj.id, label: proj.name } : undefined;
  });
  const [elapsed, setElapsed] = useState(0);
  const { timerStartMode } = useSettingsStore();

  useEffect(() => {
    if (!isTracking || !startTimestamp) {
      setElapsed(0);
      return;
    }
    const tick = () => {
      const newElapsed = Math.floor(
        (Date.now() - new Date(startTimestamp).getTime()) / 1000,
      );
      setElapsed(newElapsed);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isTracking, startTimestamp, projectId, title, projects]);

  const handleStart = () => {
    if (!taskTitle.trim()) return;
    markTimerStart();
    startTimer(taskTitle.trim(), selectedProject?.value ?? null);
    router.back();
  };

  const handleStop = () => {
    const session = stopTimer();
    if (!session) {
      router.back();
      return;
    }
    const startMs = new Date(session.startTime).getTime();
    const endMs = new Date(session.endTime).getTime();
    const apps = getAppsForWindow(startMs, endMs);
    addSession({
      id: Date.now().toString(),
      ...session,
      ...(apps.length > 0 ? { apps } : {}),
    });
    toast.show({ label: "Session logged", variant: "success" });
    router.back();
  };

  const handleProjectChange = (v: SelectOption | undefined) => {
    setSelectedProject(v);
    updateProjectId(v?.value ?? null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
  };

  const selProj = projects.find((p) => p.id === selectedProject?.value);
  const theme = useAuroraTheme();

  const navTitle = isTracking ? "Tracking" : "New Timer";

  return (
    <KeyboardAvoidingView
      behavior="padding"
      className="flex-1"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <StaticAuraBackground />
      {/* Nav bar */}
      <View className="flex-row items-center px-5 pt-2 pb-4">
        <View className="flex-1">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text className="text-neutral-400 text-base">Cancel</Text>
          </Pressable>
        </View>
        <Text className="text-white text-base font-semibold">{navTitle}</Text>
        <View className="flex-1" />
      </View>

      {isTracking ? (
        <View className="flex-1 justify-center px-8 gap-6">
          {/* Project accent line */}
          {selProj && (
            <View className="flex-row items-center gap-2">
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: selProj.color }}
              />
              <Text className="text-zinc-400 text-sm tracking-wide">
                {selProj.name}
              </Text>
            </View>
          )}

          {/* Elapsed counter */}
          <View className="gap-1">
            <Text className="text-neutral-500 text-xs uppercase tracking-widest">
              elapsed
            </Text>
            <Text
              className="text-white font-mono font-bold"
              style={styles.elapsed}
            >
              {formatTime(elapsed)}
            </Text>
          </View>

          {/* Title — editable label */}
          <View className="gap-3">
            <TextInput
              value={taskTitle}
              onChangeText={(v) => {
                setTaskTitle(v);
                updateTitle(v);
              }}
              onBlur={() => {
                const trimmed = taskTitle.trim();
                updateTitle(trimmed);
                if (trimmed) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              onSubmitEditing={() => {
                if (taskTitle.trim()) updateTitle(taskTitle.trim());
              }}
              returnKeyType="done"
              placeholder="session title"
              placeholderTextColor="rgba(255,255,255,0.15)"
              style={styles.titleInput}
            />
            <View className="h-px bg-white/10" />
          </View>

          <Select
            value={selectedProject}
            onValueChange={(v) =>
              handleProjectChange(v as SelectOption | undefined)
            }
          >
            <Select.Trigger className="bg-transparent shadow-none border border-white/10">
              <View className="flex-row items-center gap-2 flex-1">
                {selProj && (
                  <Image
                    source={`sf:${selProj.icon}`}
                    style={{ width: 16, height: 16, tintColor: selProj.color }}
                  />
                )}
                <Select.Value placeholder="Project (optional)" />
              </View>
              <Select.TriggerIndicator />
            </Select.Trigger>
            <Select.Portal hostName="timer-modal">
              <Select.Overlay />
              <Select.Content presentation="popover" width="trigger" className="border border-white/10 shadow-none bg-zinc-900">
                <Select.ListLabel>Select a project</Select.ListLabel>
                {projects.map((p) => (
                  <Select.Item key={p.id} value={p.id} label={p.name}>
                    <View className="flex-row items-center gap-3 flex-1">
                      <Image
                        source={`sf:${p.icon}`}
                        style={{ width: 18, height: 18, tintColor: p.color }}
                      />
                      <Select.ItemLabel />
                    </View>
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Portal>
          </Select>

          <Button variant="danger" onPress={handleStop}>
            <Button.Label>Stop Timer</Button.Label>
          </Button>
        </View>
      ) : (
        <NewTimerView
          mode={timerStartMode}
          taskTitle={taskTitle}
          setTaskTitle={setTaskTitle}
          selectedProject={selectedProject}
          setSelectedProject={setSelectedProject}
          projects={projects}
          onStart={handleStart}
        />
      )}
      <PortalHost name="timer-modal" />
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
// New Timer — shared types
// ─────────────────────────────────────────────

type ModeViewProps = {
  taskTitle: string;
  setTaskTitle: (t: string) => void;
  selectedProject: SelectOption | undefined;
  setSelectedProject: (p: SelectOption | undefined) => void;
  projects: Project[];
  onStart: () => void;
};

type NewTimerViewProps = ModeViewProps & {
  mode: StartMode;
};

function NewTimerView({
  mode,
  taskTitle,
  setTaskTitle,
  selectedProject,
  setSelectedProject,
  projects,
  onStart,
}: NewTimerViewProps) {
  const modeProps: ModeViewProps = {
    taskTitle,
    setTaskTitle,
    selectedProject,
    setSelectedProject,
    projects,
    onStart,
  };

  return (
    <View className="flex-1">
      <View className="flex-1 justify-center px-6">
        {mode === "a" && <ConversationalView {...modeProps} />}
        {mode === "b" && <HoldView {...modeProps} />}
        {mode === "c" && <ProjectFirstView {...modeProps} />}
      </View>
      <RecentTicker />
    </View>
  );
}

// ─────────────────────────────────────────────
// Mode A — Conversational (bare input + chips)
// ─────────────────────────────────────────────

function ConversationalView({
  taskTitle,
  setTaskTitle,
  selectedProject,
  setSelectedProject,
  projects,
  onStart,
}: ModeViewProps) {
  const titleFilled = useSharedValue(0);
  const beginScale = useSharedValue(1);

  useEffect(() => {
    const filled = taskTitle.trim().length > 0 ? 1 : 0;
    titleFilled.value = withTiming(filled, { duration: 300 });
    if (filled) {
      beginScale.value = withRepeat(
        withTiming(1.04, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(beginScale);
      beginScale.value = withTiming(1, { duration: 200 });
    }
  }, [taskTitle]);

  const beginStyle = useAnimatedStyle(() => ({
    opacity: titleFilled.value,
    transform: [{ scale: beginScale.value }],
  }));

  return (
    <Animated.View className="gap-8" entering={FadeInDown.duration(300)}>
      {/* Bare input — no border box, just a cursor on the surface */}
      <View className="gap-3">
        <Text className="text-zinc-600 text-xs uppercase tracking-widest">
          what are you focusing on?
        </Text>
        <TextInput
          value={taskTitle}
          onChangeText={setTaskTitle}
          onSubmitEditing={onStart}
          returnKeyType="go"
          autoFocus
          placeholder="deep work, reading, gym..."
          placeholderTextColor="rgba(255,255,255,0.15)"
          style={styles.titleInput}
        />
        <View className="h-px bg-white/10" />
      </View>

      {/* Project chips — horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 4, gap: 8 }}
      >
        <Pressable
          onPress={() => setSelectedProject(undefined)}
          className={`px-3 py-1.5 rounded-full border ${
            selectedProject === undefined
              ? "border-white/40 bg-white/8"
              : "border-white/12"
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              selectedProject === undefined
                ? "text-white/80"
                : "text-white/30"
            }`}
          >
            No project
          </Text>
        </Pressable>
        {projects.map((p) => {
          const isSelected = selectedProject?.value === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() =>
                setSelectedProject({ value: p.id, label: p.name })
              }
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border"
              style={
                isSelected
                  ? { borderColor: p.color, backgroundColor: p.color + "22" }
                  : { borderColor: "rgba(255,255,255,0.12)" }
              }
            >
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <Text
                className="text-xs font-medium"
                style={{
                  color: isSelected ? p.color : "rgba(255,255,255,0.35)",
                }}
              >
                {p.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Begin button — fades in and breathes once title is filled */}
      <Animated.View style={beginStyle}>
        <Button
          variant="primary"
          onPress={onStart}
          isDisabled={!taskTitle.trim()}
        >
          <Button.Label>Begin</Button.Label>
        </Button>
      </Animated.View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// Mode B — Hold to Start
// ─────────────────────────────────────────────

function HoldView({
  taskTitle,
  setTaskTitle,
  selectedProject,
  setSelectedProject,
  projects,
  onStart,
}: ModeViewProps) {
  const selProj = projects.find((p) => p.id === selectedProject?.value);
  const holdProgress = useSharedValue(0);
  const breathScale = useSharedValue(1);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    breathScale.value = withRepeat(
      withTiming(1.06, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const handlePressIn = () => {
    if (!taskTitle.trim()) return;
    cancelAnimation(breathScale);
    breathScale.value = withTiming(1, { duration: 150 });
    holdProgress.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.quad),
    });
    holdTimerRef.current = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onStart();
    }, 600);
  };

  const handlePressOut = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdProgress.value = withTiming(0, { duration: 250 });
    breathScale.value = withRepeat(
      withTiming(1.06, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  };

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: HOLD_CIRCUMFERENCE * (1 - holdProgress.value),
  }));

  const ringContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
  }));

  const ringColor = selProj?.color ?? "rgba(255,255,255,0.6)";
  const canStart = taskTitle.trim().length > 0;

  return (
    <Animated.View className="gap-5" entering={FadeInDown.duration(300)}>
      <Input
        placeholder="What are you working on?"
        value={taskTitle}
        onChangeText={setTaskTitle}
        returnKeyType="done"
        autoFocus
        className="bg-transparent border-white/10"
      />

      <Select
        value={selectedProject}
        onValueChange={(v) =>
          setSelectedProject(v as SelectOption | undefined)
        }
      >
        <Select.Trigger className="bg-transparent shadow-none border border-white/10">
          <View className="flex-row items-center gap-2 flex-1">
            {selProj && (
              <Image
                source={`sf:${selProj.icon}`}
                style={{ width: 16, height: 16, tintColor: selProj.color }}
              />
            )}
            <Select.Value placeholder="Project (optional)" />
          </View>
          <Select.TriggerIndicator />
        </Select.Trigger>
        <Select.Portal hostName="timer-modal">
          <Select.Overlay />
          <Select.Content presentation="popover" width="trigger">
            <Select.ListLabel>Select a project</Select.ListLabel>
            {projects.map((p) => (
              <Select.Item key={p.id} value={p.id} label={p.name}>
                <View className="flex-row items-center gap-3 flex-1">
                  <Image
                    source={`sf:${p.icon}`}
                    style={{ width: 18, height: 18, tintColor: p.color }}
                  />
                  <Select.ItemLabel />
                </View>
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Portal>
      </Select>

      {/* Hold ring */}
      <View className="items-center gap-3 py-2">
        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
          <Animated.View style={ringContainerStyle}>
            <Svg width={174} height={174}>
              {/* Track */}
              <Circle
                cx={87}
                cy={87}
                r={HOLD_R}
                stroke="rgba(255,255,255,0.07)"
                strokeWidth={2.5}
                fill="none"
              />
              {/* Fill arc */}
              <AnimatedCircle
                cx={87}
                cy={87}
                r={HOLD_R}
                stroke={ringColor}
                strokeWidth={2.5}
                fill="none"
                strokeDasharray={`${HOLD_CIRCUMFERENCE}`}
                strokeLinecap="round"
                rotation={-90}
                origin="87, 87"
                animatedProps={arcProps}
              />
            </Svg>
          </Animated.View>
        </Pressable>
        <Text
          className="text-xs uppercase tracking-widest"
          style={{
            color: canStart
              ? "rgba(255,255,255,0.3)"
              : "rgba(255,255,255,0.12)",
          }}
        >
          {canStart ? "hold to begin" : "enter a title first"}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// Mode C — Project First
// ─────────────────────────────────────────────

function ProjectFirstView({
  taskTitle,
  setTaskTitle,
  selectedProject,
  setSelectedProject,
  projects,
  onStart,
}: ModeViewProps) {
  const [step, setStep] = useState<"pick" | "title">("pick");

  const handlePickProject = (p: Project | null) => {
    setSelectedProject(p ? { value: p.id, label: p.name } : undefined);
    setStep("title");
  };

  if (step === "pick") {
    return (
      <Animated.View className="gap-2" entering={FadeInDown.duration(300)}>
        <Text className="text-zinc-600 text-xs uppercase tracking-widest mb-2">
          what are you working on?
        </Text>
        {projects.map((p, i) => (
          <Animated.View
            key={p.id}
            entering={FadeInDown.delay(i * 55).duration(280)}
          >
            <Pressable
              onPress={() => handlePickProject(p)}
              className="flex-row items-center gap-3 px-4 py-4 rounded-2xl"
              style={{
                backgroundColor: p.color + "14",
                borderWidth: 1,
                borderColor: p.color + "28",
              }}
            >
              <View
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <Text className="text-white text-base font-medium flex-1">
                {p.name}
              </Text>
              <Image
                source="sf:chevron.right"
                style={{
                  width: 11,
                  height: 11,
                  tintColor: p.color + "70",
                }}
              />
            </Pressable>
          </Animated.View>
        ))}
        <Animated.View
          entering={FadeInDown.delay(projects.length * 55).duration(280)}
        >
          <Pressable
            onPress={() => handlePickProject(null)}
            className="flex-row items-center gap-3 px-4 py-4 rounded-2xl"
            style={{ borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}
          >
            <View className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            <Text className="text-zinc-500 text-base flex-1">No project</Text>
            <Image
              source="sf:chevron.right"
              style={{
                width: 11,
                height: 11,
                tintColor: "rgba(255,255,255,0.15)",
              }}
            />
          </Pressable>
        </Animated.View>
      </Animated.View>
    );
  }

  const selProj = selectedProject
    ? projects.find((p) => p.id === selectedProject.value)
    : null;

  return (
    <Animated.View className="gap-5" entering={FadeInDown.duration(250)}>
      {/* Back to project pick */}
      <Pressable
        onPress={() => setStep("pick")}
        className="flex-row items-center gap-1.5 self-start"
      >
        <Image
          source="sf:chevron.left"
          style={{
            width: 13,
            height: 13,
            tintColor: selProj?.color ?? "rgba(255,255,255,0.4)",
          }}
        />
        {selProj ? (
          <View className="flex-row items-center gap-2">
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: selProj.color }}
            />
            <Text className="text-sm font-medium" style={{ color: selProj.color }}>
              {selProj.name}
            </Text>
          </View>
        ) : (
          <Text className="text-zinc-500 text-sm">No project</Text>
        )}
      </Pressable>

      <Input
        placeholder="What are you working on?"
        value={taskTitle}
        onChangeText={setTaskTitle}
        onSubmitEditing={onStart}
        returnKeyType="go"
        autoFocus
        className="bg-transparent border-white/10"
      />

      <Button variant="primary" onPress={onStart} isDisabled={!taskTitle.trim()}>
        <Button.Label>Start Timer</Button.Label>
      </Button>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// Ambient ticker — recent sessions scroll
// ─────────────────────────────────────────────

function RecentTicker() {
  const { sessions } = useSessionsStore();
  const { projects } = useProjects();
  const translateX = useSharedValue(0);

  const recent = sessions.slice(-7).reverse();
  if (recent.length < 2) return null;

  const items = recent.map((s) => {
    const proj = s.projectId
      ? projects.find((p) => p.id === s.projectId)
      : null;
    return {
      label: s.title,
      color: proj?.color ?? "#3f3f46",
      projectName: proj?.name ?? null,
    };
  });

  const ITEM_WIDTH = 196;
  const loopWidth = ITEM_WIDTH * items.length;

  useEffect(() => {
    translateX.value = 0;
    translateX.value = withRepeat(
      withTiming(-loopWidth, {
        duration: loopWidth * 28,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [loopWidth]);

  const tickerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View className="overflow-hidden py-2" style={{ opacity: 0.55 }}>
      <Animated.View className="flex-row" style={tickerStyle}>
        {[...items, ...items].map((item, i) => (
          <View
            key={i}
            className="flex-row items-center gap-2"
            style={{ width: ITEM_WIDTH, paddingRight: 28 }}
          >
            <View
              className="w-1 h-1 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <Text
              className="text-zinc-600 text-xs"
              numberOfLines={1}
              style={{ flex: 1 }}
            >
              {item.projectName ? `${item.projectName} · ` : ""}
              {item.label}
            </Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Mode switcher dots
// ─────────────────────────────────────────────

function DotIndicator({ isActive }: { isActive: boolean }) {
  const width = useSharedValue(isActive ? 18 : 6);

  useEffect(() => {
    width.value = withTiming(isActive ? 18 : 6, { duration: 220 });
  }, [isActive]);

  const style = useAnimatedStyle(() => ({ width: width.value }));

  return (
    <Animated.View
      className={`rounded-full ${
        isActive ? "bg-white/55" : "bg-white/18"
      }`}
      style={[
        style,
        styles.dotIndicator,
      ]}
    />
  );
}

function ModeSwitcher({
  mode,
  onModeChange,
}: {
  mode: StartMode;
  onModeChange: (m: StartMode) => void;
}) {
  const modes: StartMode[] = ["a", "b", "c"];
  return (
    <View className="flex-row items-center justify-center gap-2 pb-4 pt-2">
      {modes.map((m) => (
        <Pressable key={m} onPress={() => onModeChange(m)} hitSlop={12}>
          <DotIndicator isActive={m === mode} />
        </Pressable>
      ))}
    </View>
  );
}
