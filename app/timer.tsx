import { StaticAuraBackground } from "@/components/static-aura-background";
import type { Project } from "@/constants/projects";
import { useAuroraTheme } from "@/hooks/use-aurora-theme";
import { getAppUsage } from "@/lib/activitywatch";
import { useProjects } from "@/stores/projects-store";
import { useSessionsStore, type AppUsage } from "@/stores/sessions-store";
import {
  getSmartDefaultApps,
  useSuggestionsStore,
  type AssociationMap,
} from "@/stores/suggestions-store";
import { useTimerStore } from "@/stores/timer-store";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Input, PortalHost, Select } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SelectOption = { value: string; label: string };

type PendingSession = {
  title: string;
  projectId: string | null;
  startTime: string;
  endTime: string;
  duration: number;
};

type AutoConfirmState = {
  session: PendingSession;
  apps: AppUsage[];
  selectedApps: AppUsage[];
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
  const { learnFromSession, suggestProject, associations } =
    useSuggestionsStore();
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

  const [reviewData, setReviewData] = useState<{
    session: PendingSession;
    apps: AppUsage[];
    loading: boolean;
  } | null>(null);

  const [autoConfirm, setAutoConfirm] = useState<AutoConfirmState | null>(null);
  const autoConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [suggestion, setSuggestion] = useState<{
    projectId: string;
    matchedApps: string[];
  } | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  // Cleanup auto-confirm timer on unmount
  useEffect(() => {
    return () => {
      if (autoConfirmTimerRef.current) clearTimeout(autoConfirmTimerRef.current);
    };
  }, []);

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

  const handleSaveReview = (selectedApps: AppUsage[], pendingSession?: PendingSession) => {
    const session = pendingSession ?? reviewData?.session;
    if (!session) return;
    addSession({
      id: Date.now().toString(),
      ...session,
      apps: selectedApps.length > 0 ? selectedApps : undefined,
    });
    if (session.projectId !== null && selectedApps.length > 0) {
      learnFromSession(selectedApps, session.projectId);
    }
    setReviewData(null);
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

    const apps = await getAppUsage(session.startTime, session.endTime);
    const totalDuration = apps.reduce((sum, a) => sum + a.duration, 0);

    // Auto-confirm eligibility: project must match suggestion with high confidence + coverage
    if (session.projectId && apps.length > 0 && totalDuration > 0) {
      const result = suggestProject(apps);
      const coverageRatio = result ? result.totalCoveredDuration / totalDuration : 0;

      const isHighConfidence =
        result !== null &&
        result.projectId === session.projectId &&
        result.score >= 5 &&
        coverageRatio >= 0.6;

      if (isHighConfidence) {
        const defaultAppSet = getSmartDefaultApps(apps, session.projectId, associations);
        const selected = apps.filter((a) => defaultAppSet.has(a.app));

        setReviewData(null);
        setAutoConfirm({ session, apps, selectedApps: selected });

        autoConfirmTimerRef.current = setTimeout(() => {
          handleSaveReview(selected, session);
          setAutoConfirm(null);
        }, 2500);

        return;
      }
    }

    setReviewData((prev) => (prev ? { ...prev, apps, loading: false } : null));
  };

  const handleCancelAutoConfirm = () => {
    if (autoConfirmTimerRef.current) {
      clearTimeout(autoConfirmTimerRef.current);
      autoConfirmTimerRef.current = null;
    }
    if (autoConfirm) {
      setReviewData({ session: autoConfirm.session, apps: autoConfirm.apps, loading: false });
      setAutoConfirm(null);
    }
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
  const theme = useAuroraTheme();

  const navTitle = autoConfirm
    ? "Saving..."
    : reviewData
      ? "Review"
      : isTracking
        ? "Tracking"
        : "New Timer";

  return (
    <KeyboardAvoidingView
      behavior="padding"
      className="flex-1"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <StaticAuraBackground />
      {/* Nav bar */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text className="text-neutral-400 text-base">Cancel</Text>
        </Pressable>
        <Text className="text-white text-base font-semibold">{navTitle}</Text>
        <View className="w-14" />
      </View>

      {autoConfirm ? (
        <AutoConfirmView autoConfirm={autoConfirm} onCancel={handleCancelAutoConfirm} />
      ) : reviewData ? (
        <ReviewView
          reviewData={reviewData}
          associations={associations}
          onSave={handleSaveReview}
          onDiscard={handleDiscardReview}
        />
      ) : isTracking ? (
        <View className="flex-1 justify-center px-6 gap-5">
          <View
            className="items-center justify-center rounded-3xl py-8"
            style={{
              backgroundColor: theme.card,
              shadowColor: "#000",
              shadowOffset: { width: 6, height: 6 },
              shadowOpacity: 0.6,
              shadowRadius: 12,
            }}
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

type AutoConfirmViewProps = {
  autoConfirm: AutoConfirmState;
  onCancel: () => void;
};

function AutoConfirmView({ autoConfirm, onCancel }: AutoConfirmViewProps) {
  const theme = useAuroraTheme();
  const { session, selectedApps } = autoConfirm;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 2500, easing: Easing.linear });
  }, []);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as unknown as number,
  }));

  const appNames = selectedApps.map((a) => a.app).join(", ");

  return (
    <Animated.View
      className="flex-1 justify-center px-6 gap-5"
      entering={FadeInDown.duration(200)}
    >
      <View
        className="rounded-3xl p-5 border gap-3"
        style={{ backgroundColor: theme.card, borderColor: theme.cardBorder }}
      >
        <View className="flex-row items-center gap-2">
          <Image
            source="sf:checkmark.circle.fill"
            style={{ width: 20, height: 20, tintColor: "#10b981" }}
          />
          <Text className="text-emerald-500 text-sm font-semibold">
            Saving automatically
          </Text>
        </View>

        <Text className="text-white text-lg font-semibold">{session.title}</Text>
        <Text className="text-zinc-400 text-sm">{formatTime(session.duration)}</Text>

        {appNames.length > 0 && (
          <Text className="text-zinc-500 text-xs" numberOfLines={1}>
            {appNames}
          </Text>
        )}

        {/* Progress bar */}
        <View className="h-px rounded-full overflow-hidden mt-1" style={{ backgroundColor: theme.cardBorder }}>
          <Animated.View
            className="h-full rounded-full bg-emerald-500"
            style={progressStyle}
          />
        </View>
      </View>

      <Button variant="ghost" onPress={onCancel}>
        <Button.Label>Cancel</Button.Label>
      </Button>
    </Animated.View>
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

function ReviewView({
  reviewData,
  associations,
  onSave,
  onDiscard,
}: ReviewViewProps) {
  const theme = useAuroraTheme();
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
          associations,
        ),
      );
    }
  }, [
    reviewData.loading,
    reviewData.apps,
    reviewData.session.projectId,
    associations,
  ]);

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
    const selected = reviewData.apps.filter((a) => selectedApps.has(a.app));
    onSave(selected);
  };

  const isEmpty = reviewData.apps.length === 0;
  const { session, apps, loading } = reviewData;

  return (
    <Animated.View className="flex-1" entering={FadeInDown.duration(300)}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1 px-6"
      >
        {/* Session summary card */}
        <View
          className="mb-6 rounded-3xl p-5 border"
          style={{ backgroundColor: theme.card, borderColor: theme.cardBorder }}
        >
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
            <View
              className="items-center justify-center py-8 rounded-2xl border"
              style={{
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              }}
            >
              <Text className="text-zinc-400 text-base">
                No activity detected
              </Text>
            </View>
          ) : (
            <View
              className="rounded-2xl border overflow-hidden"
              style={{
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              }}
            >
              {apps.map((app, i) => {
                const isSelected = selectedApps.has(app.app);
                const titles = app.titles ?? [];
                return (
                  <Pressable
                    key={app.app}
                    onPress={() => handleToggleApp(app.app)}
                    className="flex-row items-start gap-3 px-4 py-3"
                    style={
                      i < apps.length - 1
                        ? {
                            borderBottomWidth: 1,
                            borderBottomColor: theme.cardBorder,
                          }
                        : undefined
                    }
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
          <Button.Label>Save Session</Button.Label>
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
  const theme = useAuroraTheme();
  const proj = projects.find((p) => p.id === suggestion.projectId);
  if (!proj) return null;

  return (
    <View
      className="px-4 py-4 rounded-2xl border gap-3"
      style={{ backgroundColor: theme.card, borderColor: theme.cardBorder }}
    >
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
