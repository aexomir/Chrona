import { useAwStream } from "@/features/activity-watch/use-aw-stream";
import { useProjects } from "@/features/projects/projects-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { useSyncWatch, useWatchMessages } from "@/features/watch/use-watch";
import { useWidgetSync } from "@/features/watch/use-widget-sync";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import "../global.css";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  useWidgetSync();
  useAwStream();
  useWatchMessages(
    () => {
      const { isTracking, startTimer } = useTimerStore.getState();
      if (!isTracking) startTimer("Watch Session");
    },
    () => {
      const { stopTimer } = useTimerStore.getState();
      const { addSession } = useSessionsStore.getState();
      const result = stopTimer();
      if (result) {
        addSession({
          id: Date.now().toString(),
          title: result.title || "Watch Session",
          projectId: result.projectId,
          startTime: result.startTime,
          endTime: result.endTime,
          duration: result.duration,
        });
      }
    },
    (projectId) => {
      const { isTracking, startTimer } = useTimerStore.getState();
      if (!isTracking) startTimer("", projectId);
    },
    (title) => {
      const { isTracking, updateTitle } = useTimerStore.getState();
      if (isTracking) updateTitle(title);
    },
  );

  const syncWatch = useSyncWatch();

  useEffect(() => {
    if (process.env.EXPO_OS !== "ios") return;

    const sync = () => {
      const { isTracking, startTimestamp, title, projectId } =
        useTimerStore.getState();
      const { sessions } = useSessionsStore.getState();
      const { projects } = useProjects.getState();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todaySessions = sessions.filter(
        (s) => new Date(s.startTime) >= today,
      );
      const todaySeconds = todaySessions.reduce(
        (sum, s) => sum + s.duration,
        0,
      );

      const currentProject = projectId
        ? (projects.find((p) => p.id === projectId) ?? null)
        : null;

      syncWatch({
        isTracking,
        title: title || "",
        projectName: currentProject?.name ?? "",
        projectColor: currentProject?.color ?? "",
        startTimestamp: isTracking && startTimestamp ? startTimestamp : "",
        todayMinutes: Math.floor(todaySeconds / 60),
        todaySessions: todaySessions.length,
        recentProjects: JSON.stringify(
          projects.slice(0, 6).map((p) => ({
            id: p.id,
            name: p.name,
            color: p.color,
            icon: p.icon,
          })),
        ),
        recentSessions: JSON.stringify(
          (() => {
            const projectById = new Map(projects.map((p) => [p.id, p]));
            return todaySessions.slice(0, 8).map((s) => {
              const project = s.projectId ? projectById.get(s.projectId) : undefined;
              return {
                id: s.id,
                title: s.title || "",
                projectName: project?.name ?? "",
                projectColor: project?.color ?? "",
                startTime: s.startTime,
                duration: s.duration,
              };
            });
          })()
        ),
      });
    };

    sync();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(sync, 300);
    };
    const unsubTimer = useTimerStore.subscribe(debouncedSync);
    const unsubSessions = useSessionsStore.subscribe(debouncedSync);
    const unsubProjects = useProjects.subscribe(debouncedSync);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubTimer();
      unsubSessions();
      unsubProjects();
    };
  }, [syncWatch]);

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider config={{ toast: { defaultProps: { placement: "top" } } }}>
        <KeyboardProvider>
          <ThemeProvider value={DarkTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="timer"
                options={{ presentation: "modal", headerShown: false }}
              />
              <Stack.Screen
                name="recover"
                options={{ presentation: "modal", headerShown: false }}
              />
              <Stack.Screen
                name="calendar-settings"
                options={{ presentation: "modal", headerShown: false }}
              />
              <Stack.Screen
                name="projects"
                options={{ presentation: "modal", headerShown: false }}
              />
              <Stack.Screen
                name="untracked"
                options={{ presentation: "modal", headerShown: false }}
              />
              <Stack.Screen
                name="tracking-rules"
                options={{ presentation: "modal", headerShown: false }}
              />
              <Stack.Screen
                name="settings"
                options={{
                  title: "Settings",
                  headerTransparent: true,
                  headerTitleStyle: {
                    color: "white",
                    fontSize: 17,
                    fontWeight: "600",
                  },
                }}
              />
            </Stack>
            <StatusBar style="light" />
          </ThemeProvider>
        </KeyboardProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
