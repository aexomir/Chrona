import { AppReviewView } from "@/components/app-review-view";
import type { Project } from "@/constants/projects";
import { Neutral } from "@/constants/theme";
import { StaticAuraBackground } from "@/features/aurora/static-aura-background";
import { usePendingUsageStore } from "@/features/intelligence/pending-usage-store";
import { getAppsForWindow } from "@/features/intelligence/usage-query";
import { useProjects } from "@/features/projects/projects-store";
import { useSessionsStore, type AppUsage } from "@/features/sessions/sessions-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { formatTime } from "@/features/timer/timer-utils";
import { useAppToast } from "@/hooks/use-app-toast";
import { trackEvent } from "@/lib/sentry";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Input, PortalHost, Select } from "heroui-native";
import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SelectOption = { value: string; label: string };

const styles = StyleSheet.create({
  titleInput: {
    fontSize: 26,
    color: "#ffffff",
    letterSpacing: -0.5,
    paddingVertical: 8,
    fontWeight: "600" as const,
  },
  projectColorBg: {
    borderWidth: 1,
  },
  projectButton: {
    borderWidth: 1,
  },
  chevronIcon: {
    width: 11,
    height: 11,
  },
  noProjectBorder: {
    borderWidth: 1,
  },
});

export default function TimerScreen() {
  const projects = useProjects((s) => s.projects);
  const isTracking = useTimerStore((s) => s.isTracking);
  const isAutoTracked = useTimerStore((s) => s.isAutoTracked);
  const title = useTimerStore((s) => s.title);
  const projectId = useTimerStore((s) => s.projectId);
  const startTimestamp = useTimerStore((s) => s.startTimestamp);
  const startTimer = useTimerStore((s) => s.startTimer);
  const stopTimer = useTimerStore((s) => s.stopTimer);
  const updateTitle = useTimerStore((s) => s.updateTitle);
  const updateProjectId = useTimerStore((s) => s.updateProjectId);
  const addSession = useSessionsStore((s) => s.addSession);
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

  type PendingSession = {
    session: {
      startTime: string;
      endTime: string;
      duration: number;
      title: string;
      projectId: string | null;
      auto?: boolean;
    };
    apps: AppUsage[];
  };
  const [pendingSession, setPendingSession] = useState<PendingSession | null>(null);
  const [isResolvingApps, setIsResolvingApps] = useState(false);

  useEffect(() => {
    if (!isTracking || !startTimestamp) return;
    const tick = () => {
      const newElapsed = Math.floor(
        (Date.now() - new Date(startTimestamp).getTime()) / 1000,
      );
      setElapsed(newElapsed);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isTracking, startTimestamp]);

  const handleStart = () => {
    if (!taskTitle.trim()) return;
    startTimer(taskTitle.trim(), selectedProject?.value ?? null);
    trackEvent("timer", "timer_start", {
      auto: false,
      hasProject: !!selectedProject,
    });
    router.back();
  };

  const handleStop = async () => {
    if (isResolvingApps) return;
    const wasAutoTracked = isAutoTracked;
    const session = stopTimer();
    if (!session) {
      router.back();
      return;
    }
    trackEvent("timer", "timer_stop", {
      auto: wasAutoTracked,
      duration: session.duration,
    });

    const startMs = new Date(session.startTime).getTime();
    const endMs = new Date(session.endTime).getTime();

    setIsResolvingApps(true);
    const { status, apps } = await getAppsForWindow(startMs, endMs);
    setIsResolvingApps(false);

    if (apps.length > 0) {
      setPendingSession({
        session: { ...session, ...(wasAutoTracked ? { auto: true } : {}) },
        apps,
      });
      return;
    }

    const id = Date.now().toString();
    addSession({
      id,
      ...session,
      ...(wasAutoTracked ? { auto: true } : {}),
    });
    if (status === "unreachable") {
      // The Mac still has the answer — patch this session once it reconnects.
      usePendingUsageStore.getState().enqueue(id, startMs, endMs);
    }
    trackEvent("session", "session_save", {
      auto: wasAutoTracked,
      duration: session.duration,
      appCount: 0,
    });
    toast.show({ label: "Session logged", variant: "success" });
    router.back();
  };

  const handleConfirm = (selectedApps: AppUsage[]) => {
    if (!pendingSession) return;
    addSession({
      id: Date.now().toString(),
      ...pendingSession.session,
      ...(selectedApps.length > 0 ? { apps: selectedApps } : {}),
    });
    trackEvent("session", "session_save", {
      auto: !!pendingSession.session.auto,
      duration: pendingSession.session.duration,
      appCount: selectedApps.length,
    });
    toast.show({ label: "Session logged", variant: "success" });
    router.back();
  };

  const handleSkip = () => {
    if (!pendingSession) return;
    addSession({ id: Date.now().toString(), ...pendingSession.session });
    trackEvent("session", "session_save", {
      auto: !!pendingSession.session.auto,
      duration: pendingSession.session.duration,
      appCount: 0,
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

  const navTitle = pendingSession ? "Review Apps" : isTracking ? "Tracking" : "New Timer";

  return (
    <KeyboardAvoidingView
      behavior="padding"
      className="flex-1"
      style={[{ paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <StaticAuraBackground />
      <View className="flex-row items-center px-5 pt-2 pb-4">
        <View className="flex-1">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text className="text-neutral-400 text-base">Cancel</Text>
          </Pressable>
        </View>
        <Text className="text-white text-base font-semibold">{navTitle}</Text>
        <View className="flex-1" />
      </View>

      {pendingSession ? (
        <AppReviewView
          apps={pendingSession.apps}
          sessionTitle={pendingSession.session.title}
          sessionProjectId={pendingSession.session.projectId}
          onConfirm={handleConfirm}
          onSkip={handleSkip}
        />
      ) : isTracking ? (
        <View className="flex-1 justify-center px-8 gap-6">
          {selProj && (
            <View className="flex-row items-center gap-2">
              <View
                className="w-2 h-2 rounded-full"
                style={[{ backgroundColor: selProj.color }]}
              />
              <Text className="text-zinc-400 text-sm tracking-wide">
                {selProj.name}
              </Text>
            </View>
          )}

          <View className="gap-1">
            <Text className="text-neutral-500 text-xs uppercase tracking-widest">
              elapsed
            </Text>
            <Text
              className="text-white font-mono font-bold text-[72px] leading-[80px] tracking-[-2px]"
            >
              {formatTime(isTracking ? elapsed : 0)}
            </Text>
          </View>

          <View className="gap-3">
            <TextInput
              value={taskTitle}
              onChangeText={(v) => {
                setTaskTitle(v);
                updateTitle(v);
              }}
              onBlur={() => {
                const trimmed = taskTitle.trim();
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

          <ProjectSelect
            value={selectedProject}
            onChange={handleProjectChange}
            projects={projects}
          />

          <Button variant="danger" onPress={handleStop} isDisabled={isResolvingApps}>
            <Button.Label>
              {isResolvingApps ? "Collecting app usage…" : "Stop Timer"}
            </Button.Label>
          </Button>
        </View>
      ) : (
        <NewTimerView
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
// Shared project picker
// ─────────────────────────────────────────────

function ProjectSelect({
  value,
  onChange,
  projects,
}: {
  value: SelectOption | undefined;
  onChange: (v: SelectOption | undefined) => void;
  projects: Project[];
}) {
  const selProj = projects.find((p) => p.id === value?.value);

  return (
    <Select value={value} onValueChange={(v) => onChange(v as SelectOption | undefined)}>
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
                  style={[{ width: 18, height: 18, tintColor: p.color }]}
                />
                <Select.ItemLabel />
              </View>
              <Select.ItemIndicator />
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Portal>
    </Select>
  );
}

// ─────────────────────────────────────────────
// New Timer — project-first flow
// ─────────────────────────────────────────────

type NewTimerViewProps = {
  taskTitle: string;
  setTaskTitle: (t: string) => void;
  selectedProject: SelectOption | undefined;
  setSelectedProject: (p: SelectOption | undefined) => void;
  projects: Project[];
  onStart: () => void;
};

function NewTimerView(props: NewTimerViewProps) {
  return (
    <View className="flex-1">
      <View className="flex-1 justify-center px-6">
        <ProjectFirstView {...props} />
      </View>
      <RecentTicker />
    </View>
  );
}

function ProjectFirstView({
  taskTitle,
  setTaskTitle,
  selectedProject,
  setSelectedProject,
  projects,
  onStart,
}: NewTimerViewProps) {
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
              style={[styles.projectButton, {
                backgroundColor: p.color + "14",
                borderColor: p.color + "28",
              }]}
            >
              <View
                className="w-2.5 h-2.5 rounded-full"
                style={[{ backgroundColor: p.color }]}
              />
              <Text className="text-white text-base font-medium flex-1">
                {p.name}
              </Text>
              <Image
                source="sf:chevron.right"
                style={[styles.chevronIcon, {
                  tintColor: p.color + "70",
                }]}
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
            style={[styles.noProjectBorder, { borderColor: "rgba(255,255,255,0.07)" }]}
          >
            <View className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            <Text className="text-zinc-500 text-base flex-1">No project</Text>
            <Image
              source="sf:chevron.right"
              style={[styles.chevronIcon, {
                tintColor: "rgba(255,255,255,0.15)",
              }]}
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
              style={[{ backgroundColor: selProj.color }]}
            />
            <Text className="text-sm font-medium" style={[{ color: selProj.color }]}>
              {selProj.name}
            </Text>
          </View>
        ) : (
          <Text className="text-zinc-500 text-sm">No project</Text>
        )}
      </Pressable>

      <Input
        testID="new-timer-title-input"
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

const TICKER_ITEM_WIDTH = 196;

function RecentTicker() {
  const sessions = useSessionsStore((s) => s.sessions);
  const projects = useProjects((s) => s.projects);
  const translateX = useSharedValue(0);

  const recent = sessions.slice(-7).reverse();
  const items = recent.map((s) => {
    const proj = s.projectId
      ? projects.find((p) => p.id === s.projectId)
      : null;
    return {
      label: s.title,
      color: proj?.color ?? Neutral.z700,
      projectName: proj?.name ?? null,
    };
  });

  const loopWidth = TICKER_ITEM_WIDTH * items.length;

  useEffect(() => {
    if (items.length < 2) return;
    translateX.value = 0;
    translateX.value = withRepeat(
      withTiming(-loopWidth, {
        duration: loopWidth * 28,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [loopWidth, items.length]);

  const tickerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (items.length < 2) return null;

  return (
    <View className="overflow-hidden py-2 opacity-55">
      <Animated.View className="flex-row" style={tickerStyle}>
        {[...items, ...items].map((item, i) => (
          <View
            key={i}
            className="flex-row items-center gap-2 pr-7"
            style={[{ width: TICKER_ITEM_WIDTH }]}
          >
            <View
              className="w-1 h-1 rounded-full"
              style={[{ backgroundColor: item.color }]}
            />
            <Text
              className="text-zinc-600 text-xs flex-1"
              numberOfLines={1}
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

