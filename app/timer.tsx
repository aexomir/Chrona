import { useSessionsStore, type AppUsage } from "@/stores/sessions-store";
import { useProjects } from "@/stores/projects-store";
import type { Project } from "@/constants/projects";
import { useTimerStore } from "@/stores/timer-store";
import {
  useSuggestionsStore,
  getSmartDefaultApps,
  type AssociationMap,
} from "@/stores/suggestions-store";
import { getAppUsage } from "@/lib/activitywatch";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Input, PortalHost, Select } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

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
  const { learnFromSession, suggestProject, associations } = useSuggestionsStore();
  const insets = useSafeAreaInsets();
  const { suggestProjectId, suggestEventTitle } = useLocalSearchParams<{
    suggestProjectId?: string;
    suggestEventTitle?: string;
  }>();

  const [taskTitle, setTaskTitle] = useState<string>(() => {
    if (title) return title;
    // Pre-fill with event title if provided from calendar suggestion
    if (suggestEventTitle) return decodeURIComponent(suggestEventTitle);
    return "";
  });
  const [selectedProject, setSelectedProject] = useState<
    SelectOption | undefined
  >(() => {
    // Use suggestProjectId if provided from calendar suggestion
    const projId = suggestProjectId || projectId;
    if (!projId) return undefined;
    const proj = projects.find((p) => p.id === projId);
    return proj ? { value: proj.id, label: proj.name } : undefined;
  });
  const [elapsed, setElapsed] = useState(0);

  // Session review state
  const [reviewData, setReviewData] = useState<{
    session: PendingSession;
    apps: AppUsage[];
    loading: boolean;
  } | null>(null);

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

    // Enter review state with loading
    setReviewData({ session, apps: [], loading: true });

    // Query ActivityWatch in background
    const apps = await getAppUsage(session.startTime, session.endTime);
    setReviewData((prev) =>
      prev ? { ...prev, apps, loading: false } : null
    );
  };

  const handleSaveReview = (selectedApps: AppUsage[]) => {
    if (!reviewData) return;
    addSession({
      id: Date.now().toString(),
      ...reviewData.session,
      apps: selectedApps.length > 0 ? selectedApps : undefined,
    });
    // Learn from session if we have both project and app data
    if (reviewData.session.projectId !== null && selectedApps.length > 0) {
      learnFromSession(selectedApps, reviewData.session.projectId);
    }
    setReviewData(null);
    router.back();
  };

  const handleDiscardReview = () => {
    if (!reviewData) return;
    addSession({
      id: Date.now().toString(),
      ...reviewData.session,
    });
    setReviewData(null);
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
          {reviewData
            ? "Review"
            : isTracking
              ? "Tracking"
              : "New Timer"}
        </Text>
        <View className="w-14" />
      </View>

      {reviewData ? (
        <ReviewView
          reviewData={reviewData}
          associations={associations}
          onSave={handleSaveReview}
          onDiscard={handleDiscardReview}
        />
      ) : isTracking ? (
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
    </KeyboardAvoidingView>
  );
}

type ReviewViewProps = {
  reviewData: {
    session: PendingSession;
    apps: AppUsage[];
    loading: boolean;
  };
  associations: AssociationMap;
  onSave: (selectedApps: AppUsage[]) => void;
  onDiscard: () => void;
};

function ReviewView({ reviewData, associations, onSave, onDiscard }: ReviewViewProps) {
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    if (reviewData.loading) return;
    hasInitialized.current = true;
    if (reviewData.apps.length > 0) {
      setSelectedApps(
        getSmartDefaultApps(
          reviewData.apps,
          reviewData.session.projectId,
          associations
        )
      );
    }
  }, [reviewData.loading, reviewData.apps, reviewData.session.projectId, associations]);

  const handleToggleApp = (app: string) => {
    const newSelected = new Set(selectedApps);
    if (newSelected.has(app)) {
      newSelected.delete(app);
    } else {
      newSelected.add(app);
    }
    setSelectedApps(newSelected);
  };

  const handleSave = () => {
    const selected = reviewData.apps.filter((a) =>
      selectedApps.has(a.app)
    );
    onSave(selected);
  };

  const isEmpty = reviewData.apps.length === 0;
  const { session, apps, loading } = reviewData;

  return (
    <Animated.View
      className="flex-1"
      entering={FadeInDown.duration(300)}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1 px-6"
      >
        {/* Session summary card */}
        <View className="mb-6 rounded-3xl p-5 bg-[#1a1a1c] border border-zinc-800">
          <View className="flex-row items-center gap-2 mb-3">
            <Image
              source="sf:checkmark.circle.fill"
              style={{ width: 20, height: 20, tintColor: "#10b981" }}
            />
            <Text className="text-emerald-500 text-sm font-semibold">
              Session Complete
            </Text>
          </View>
          <Text className="text-white text-lg font-semibold mb-2">
            {session.title}
          </Text>
          <Text className="text-zinc-400 text-sm">
            {formatTime(session.duration)}
          </Text>
        </View>

        {/* Apps detected section */}
        <View className="mb-6">
          <Text className="text-white text-base font-semibold mb-3">
            Apps Detected
          </Text>

          {loading ? (
            <View className="items-center justify-center py-8">
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          ) : isEmpty ? (
            <View className="items-center justify-center py-8 rounded-2xl bg-[#1a1a1c] border border-zinc-800">
              <Text className="text-zinc-400 text-base">
                No activity detected
              </Text>
            </View>
          ) : (
            <View className="rounded-2xl bg-[#1a1a1c] border border-zinc-800 overflow-hidden">
              {apps.map((app, i) => {
                const isSelected = selectedApps.has(app.app);
                const titles = app.titles ?? [];
                return (
                  <Pressable
                    key={app.app}
                    onPress={() => handleToggleApp(app.app)}
                    className={`flex-row items-start gap-3 px-4 py-3 ${
                      i < apps.length - 1 ? "border-b border-zinc-800" : ""
                    }`}
                  >
                    <View className="pt-1">
                      <View
                        className={`w-5 h-5 rounded border-2 items-center justify-center ${
                          isSelected
                            ? "border-blue-500 bg-blue-500"
                            : "border-zinc-600"
                        }`}
                      >
                        {isSelected && (
                          <Text className="text-white text-xs font-bold">
                            ✓
                          </Text>
                        )}
                      </View>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-baseline gap-2 mb-1">
                        <Text className="text-white text-base font-medium">
                          {app.app}
                        </Text>
                        <Text className="text-zinc-500 text-sm">
                          {formatDuration(app.duration)}
                        </Text>
                      </View>
                      {titles.length > 0 && (
                        <View className="gap-0.5">
                          {titles.slice(0, 2).map((title, idx) => (
                            <Text
                              key={idx}
                              className="text-zinc-400 text-xs"
                              numberOfLines={1}
                            >
                              · {title}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action buttons */}
      <View className="px-6 gap-2 py-4">
        <Button variant="primary" onPress={handleSave}>
          <Button.Label>
            {isEmpty ? "Save Session" : "Save Session"}
          </Button.Label>
        </Button>
        <Button variant="ghost" onPress={onDiscard}>
          <Button.Label>Discard</Button.Label>
        </Button>
      </View>
    </Animated.View>
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
