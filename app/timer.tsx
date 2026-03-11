import { useSessionsStore, type AppUsage } from "@/stores/sessions-store";
import { useProjects } from "@/stores/projects-store";
import type { Project } from "@/constants/projects";
import { useTimerStore } from "@/stores/timer-store";
import { useSuggestionsStore } from "@/stores/suggestions-store";
import { AwAppsModal } from "@/components/aw-apps-modal";
import { getAppUsage } from "@/lib/activitywatch";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Button, Input, PortalHost, Select } from "heroui-native";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SelectOption = { value: string; label: string };

type PendingSession = {
  title: string;
  projectId: string | null;
  startTime: string;
  endTime: string;
  duration: number;
};

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
  const { learnFromSession, suggestProject } = useSuggestionsStore();
  const insets = useSafeAreaInsets();

  const [taskTitle, setTaskTitle] = useState(title || "");
  const [selectedProject, setSelectedProject] = useState<
    SelectOption | undefined
  >(() => {
    if (!projectId) return undefined;
    const proj = projects.find((p) => p.id === projectId);
    return proj ? { value: proj.id, label: proj.name } : undefined;
  });
  const [elapsed, setElapsed] = useState(0);

  // ActivityWatch modal state
  const [showAwModal, setShowAwModal] = useState(false);
  const [pendingSession, setPendingSession] = useState<PendingSession | null>(
    null
  );
  const [awApps, setAwApps] = useState<AppUsage[]>([]);
  const [awLoading, setAwLoading] = useState(false);

  // Suggestion state
  const [suggestion, setSuggestion] = useState<
    { projectId: string; matchedApps: string[] } | null
  >(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  useEffect(() => {
    if (!isTracking || !startTimestamp) {
      setElapsed(0);
      return;
    }
    const tick = () =>
      setElapsed(
        Math.floor(
          (Date.now() - new Date(startTimestamp).getTime()) / 1000
        )
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isTracking, startTimestamp]);

  // AW query for suggestions when entering non-tracking mode
  useEffect(() => {
    if (isTracking) {
      setSuggestion(null);
      setSuggestionDismissed(false);
      return;
    }
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    getAppUsage(thirtyMinAgo.toISOString(), now.toISOString()).then((apps) => {
      if (apps.length === 0) return;
      const result = suggestProject(apps);
      setSuggestion(result);
    });
  }, [isTracking, suggestProject]);

  const handleStart = () => {
    if (!taskTitle.trim()) return;
    startTimer(taskTitle.trim(), selectedProject?.value ?? null);
    router.back();
  };

  const handleStop = async () => {
    const session = stopTimer();
    if (!session) {
      router.back();
      return;
    }

    // Store pending session and open modal
    setPendingSession(session);
    setShowAwModal(true);
    setAwLoading(true);

    // Query ActivityWatch in background
    const apps = await getAppUsage(session.startTime, session.endTime);
    setAwApps(apps);
    setAwLoading(false);
  };

  const handleSaveSession = (selectedApps: AppUsage[]) => {
    if (pendingSession) {
      addSession({
        id: Date.now().toString(),
        ...pendingSession,
        apps: selectedApps.length > 0 ? selectedApps : undefined,
      });
      // Learn from session if we have both project and app data
      if (pendingSession.projectId !== null && selectedApps.length > 0) {
        learnFromSession(selectedApps, pendingSession.projectId);
      }
    }
    setShowAwModal(false);
    setPendingSession(null);
    setAwApps([]);
    router.back();
  };

  const handleSkipSession = () => {
    if (pendingSession) {
      addSession({
        id: Date.now().toString(),
        ...pendingSession,
      });
    }
    setShowAwModal(false);
    setPendingSession(null);
    setAwApps([]);
    router.back();
  };

  const handleProjectChange = (v: SelectOption | undefined) => {
    setSelectedProject(v);
    updateProjectId(v?.value ?? null);
  };

  const handleAcceptSuggestion = () => {
    if (!suggestion) return;
    const proj = projects.find((p) => p.id === suggestion.projectId);
    if (!proj) return;
    handleProjectChange({ value: proj.id, label: proj.name });
    setSuggestionDismissed(true);
  };

  const showSuggestionBanner =
    !isTracking &&
    suggestion !== null &&
    !suggestionDismissed &&
    selectedProject === undefined;

  const selProj = projects.find((p) => p.id === selectedProject?.value);

  return (
    <KeyboardAvoidingView
      behavior="padding"
      className="flex-1 bg-[#111113]"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* Nav bar */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text className="text-neutral-400 text-base">Cancel</Text>
        </Pressable>
        <Text className="text-white text-base font-semibold">
          {isTracking ? "Tracking" : "New Timer"}
        </Text>
        <View className="w-14" />
      </View>

      {isTracking ? (
        <View className="flex-1 justify-center px-6 gap-5">
          <View
            className="items-center justify-center rounded-3xl py-8 bg-[#1a1a1c]"
            style={styles.card}
          >
            <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
              elapsed
            </Text>
            <Text className="text-white text-7xl font-mono font-bold">
              {formatTime(elapsed)}
            </Text>
          </View>

          <Input
            placeholder="What are you working on?"
            value={taskTitle}
            onChangeText={setTaskTitle}
            onBlur={() => {
              if (taskTitle.trim()) updateTitle(taskTitle.trim());
            }}
            onSubmitEditing={() => {
              if (taskTitle.trim()) updateTitle(taskTitle.trim());
            }}
            returnKeyType="done"
          />

          <Select
            value={selectedProject}
            onValueChange={(v) =>
              handleProjectChange(v as SelectOption | undefined)
            }
          >
            <Select.Trigger>
              <View className="flex-row items-center gap-2 flex-1">
                {selProj && (
                  <Image
                    source={`sf:${selProj.icon}`}
                    style={[styles.icon16, { tintColor: selProj.color }]}
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
                        style={[styles.icon18, { tintColor: p.color }]}
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
        <View className="flex-1 justify-center px-6 gap-5">
          <Input
            placeholder="What are you working on?"
            value={taskTitle}
            onChangeText={setTaskTitle}
            onSubmitEditing={handleStart}
            returnKeyType="go"
            autoFocus
          />

          {showSuggestionBanner && (
            <SuggestionBanner
              suggestion={suggestion!}
              projects={projects}
              onAccept={handleAcceptSuggestion}
              onDismiss={() => setSuggestionDismissed(true)}
            />
          )}

          <Select
            value={selectedProject}
            onValueChange={(v) => setSelectedProject(v as SelectOption)}
          >
            <Select.Trigger>
              <View className="flex-row items-center gap-2 flex-1">
                {selProj && (
                  <Image
                    source={`sf:${selProj.icon}`}
                    style={[styles.icon16, { tintColor: selProj.color }]}
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
                        style={[styles.icon18, { tintColor: p.color }]}
                      />
                      <Select.ItemLabel />
                    </View>
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Portal>
          </Select>

          <Button
            variant="primary"
            onPress={handleStart}
            isDisabled={!taskTitle.trim()}
          >
            <Button.Label>Start Timer</Button.Label>
          </Button>
        </View>
      )}
      <PortalHost name="timer-modal" />

      {/* ActivityWatch Apps Modal */}
      <AwAppsModal
        visible={showAwModal}
        apps={awApps}
        loading={awLoading}
        onSave={handleSaveSession}
        onSkip={handleSkipSession}
      />
    </KeyboardAvoidingView>
  );
}

type SuggestionBannerProps = {
  suggestion: { projectId: string; matchedApps: string[] };
  projects: Project[];
  onAccept: () => void;
  onDismiss: () => void;
};

function SuggestionBanner({
  suggestion,
  projects,
  onAccept,
  onDismiss,
}: SuggestionBannerProps) {
  const proj = projects.find((p) => p.id === suggestion.projectId);
  if (!proj) return null;

  return (
    <View className="px-4 py-4 rounded-2xl bg-[#1a1a1c] border border-zinc-800 gap-3">
      {/* Header with project color and name */}
      <View className="flex-row items-center gap-3">
        <View
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: proj.color }}
        />
        <Text className="text-white text-sm font-semibold flex-1">
          {proj.name}
        </Text>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text className="text-zinc-500 text-lg leading-none">×</Text>
        </Pressable>
      </View>

      {/* App list */}
      <View className="gap-1.5">
        <Text className="text-zinc-400 text-xs uppercase tracking-wide">
          Detected Apps
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {suggestion.matchedApps.map((app, i) => (
            <View
              key={i}
              className="bg-zinc-700/50 px-3 py-1.5 rounded-lg border border-zinc-600"
            >
              <Text className="text-zinc-200 text-xs font-medium">{app}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Action button */}
      <Pressable
        onPress={onAccept}
        className="bg-blue-600 active:bg-blue-700 rounded-lg py-3 items-center"
      >
        <Text className="text-white text-sm font-semibold">
          Track as {proj.name}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  icon16: { width: 16, height: 16 },
  icon18: { width: 18, height: 18 },
});
