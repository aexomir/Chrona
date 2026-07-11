import { useRef } from "react";
import { SectionLabel } from "@/components/section-label";
import { AnimatedHeaderScrollView } from "@/components/animated-header-scroll-view";
import { Neutral, Semantic } from "@/constants/theme";
import { StaticAuraBackground } from "@/features/aurora/static-aura-background";
import { useAuroraTheme } from "@/features/aurora/use-aurora-theme";
import { calendarStatusLabel } from "@/features/calendar/calendar";
import { useCalendarStore } from "@/features/calendar/calendar-store";
import { useSettingsStore } from "@/features/settings/settings-store";
import { useStreamStore } from "@/features/stream/stream-store";
import type { ConnectionStatus } from "@/modules/chrona-stream";
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { ListGroup, Separator, Switch } from "heroui-native";

import { Pressable, StyleSheet, Text, View } from "react-native";

const MAC_STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string }> = {
  idle: { label: "Off", color: Neutral.z600 },
  scanning: { label: "Searching…", color: "#d97706" },
  connecting: { label: "Connecting…", color: "#d97706" },
  connected: { label: "Connected", color: Semantic.success },
  disconnected: { label: "Not Found", color: Neutral.z600 },
};

const DEV_MODE_TAP_THRESHOLD = 5;
const DEV_MODE_TAP_WINDOW_MS = 2000;

function ValueChevronSuffix({ value }: { value: string }) {
  return (
    <ListGroup.ItemSuffix className="flex-row items-center gap-1">
      <Text className="text-neutral-500 text-sm">{value}</Text>
      <Image source="sf:chevron.right" style={styles.chevron} tintColor="#636366" />
    </ListGroup.ItemSuffix>
  );
}

function MacHelperStatus({ status }: { status: ConnectionStatus }) {
  const { label, color } = MAC_STATUS_CONFIG[status];
  return (
    <ListGroup.ItemSuffix className="flex-row items-center gap-2">
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={{ color, fontSize: 14 }}>{label}</Text>
      <Image source="sf:arrow.clockwise" style={styles.chevron} tintColor="#636366" />
    </ListGroup.ItemSuffix>
  );
}

function formatTimestamp(ts: number | null): string {
  if (ts === null) return "—";
  return new Date(ts).toLocaleTimeString();
}

function formatEventTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString();
}

export default function SettingsScreen() {
  const theme = useAuroraTheme();
  const permissionStatus = useCalendarStore((s) => s.permissionStatus);
  const isEnabled = useCalendarStore((s) => s.isEnabled);
  const streamStatus = useStreamStore((s) => s.status);
  const pathSatisfied = useStreamStore((s) => s.pathSatisfied);
  const currentEvent = useStreamStore((s) => s.currentEvent);
  const lastEventTime = useStreamStore((s) => s.lastEventTime);
  const lastHeartbeat = useStreamStore((s) => s.lastHeartbeat);
  const reconnect = useStreamStore((s) => s.reconnect);
  const clearEndpointCache = useStreamStore((s) => s.clearEndpointCache);
  const {
    auroraEnabled,
    setAuroraEnabled,
    constellationEnabled,
    setConstellationEnabled,
    developerMode,
    setDeveloperMode,
  } = useSettingsStore();

  const devTapCount = useRef(0);
  const devTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVersionTap = () => {
    devTapCount.current += 1;
    if (devTapTimer.current) clearTimeout(devTapTimer.current);
    if (devTapCount.current >= DEV_MODE_TAP_THRESHOLD) {
      devTapCount.current = 0;
      setDeveloperMode(!developerMode);
      return;
    }
    devTapTimer.current = setTimeout(() => {
      devTapCount.current = 0;
    }, DEV_MODE_TAP_WINDOW_MS);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.modalSheet }}>
      <StaticAuraBackground />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="chevron.left"
          onPress={() => router.back()}
        />
      </Stack.Toolbar>
      <AnimatedHeaderScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      >
        {/* APPEARANCE */}
        <SectionLabel>Appearance</SectionLabel>
        <ListGroup className={theme.listGroupClassName}>
          <ListGroup.Item>
            <ListGroup.ItemContent>
              <ListGroup.ItemTitle>Aurora Theme</ListGroup.ItemTitle>
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix>
              <Switch
                isSelected={auroraEnabled}
                onSelectedChange={setAuroraEnabled}
              />
            </ListGroup.ItemSuffix>
          </ListGroup.Item>
          <Separator className="mx-4" />
          <ListGroup.Item>
            <ListGroup.ItemContent>
              <ListGroup.ItemTitle>Constellation</ListGroup.ItemTitle>
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix>
              <Switch
                isSelected={constellationEnabled}
                onSelectedChange={setConstellationEnabled}
              />
            </ListGroup.ItemSuffix>
          </ListGroup.Item>
        </ListGroup>

        {/* INTEGRATIONS */}
        <View className="mt-10">
          <SectionLabel>Integrations</SectionLabel>
          <ListGroup className={theme.listGroupClassName}>
            <ListGroup.Item
              onPress={reconnect}
              onLongPress={() => {
                clearEndpointCache();
                reconnect();
              }}
            >
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>Mac Helper</ListGroup.ItemTitle>
              </ListGroup.ItemContent>
              <MacHelperStatus status={streamStatus} />
            </ListGroup.Item>
            <Separator className="mx-4" />
            <ListGroup.Item onPress={() => router.push("/calendar-settings")}>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>Calendar</ListGroup.ItemTitle>
              </ListGroup.ItemContent>
              <ValueChevronSuffix
                value={calendarStatusLabel(permissionStatus, isEnabled)}
              />
            </ListGroup.Item>
          </ListGroup>
        </View>

        {/* DATA */}
        <View className="mt-10">
          <SectionLabel>Data</SectionLabel>
          <ListGroup className={theme.listGroupClassName}>
            <ListGroup.Item onPress={() => router.push("/projects")}>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>Projects</ListGroup.ItemTitle>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix />
            </ListGroup.Item>
          </ListGroup>
        </View>

        {/* DBG */}
        {developerMode && (
          <View className="mt-10">
            <SectionLabel>DBG</SectionLabel>
            <ListGroup className={theme.listGroupClassName}>
              <ListGroup.Item>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>Status</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix>
                  <Text className="text-neutral-400 text-sm font-mono">{streamStatus}</Text>
                </ListGroup.ItemSuffix>
              </ListGroup.Item>
              <Separator className="mx-4" />
              <ListGroup.Item>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>Network</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix>
                  <Text className={`text-sm font-mono ${pathSatisfied ? "text-green-500" : "text-neutral-500"}`}>
                    {pathSatisfied ? "satisfied" : "unsatisfied"}
                  </Text>
                </ListGroup.ItemSuffix>
              </ListGroup.Item>
              <Separator className="mx-4" />
              <ListGroup.Item>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>Last Received</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix>
                  <Text className="text-neutral-400 text-sm font-mono">{formatTimestamp(lastEventTime)}</Text>
                </ListGroup.ItemSuffix>
              </ListGroup.Item>
              <Separator className="mx-4" />
              <ListGroup.Item>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>Last Heartbeat</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix>
                  <Text className="text-neutral-400 text-sm font-mono">{formatTimestamp(lastHeartbeat)}</Text>
                </ListGroup.ItemSuffix>
              </ListGroup.Item>
              {currentEvent && (
                <>
                  <Separator className="mx-4" />
                  <ListGroup.Item>
                    <ListGroup.ItemContent>
                      <ListGroup.ItemTitle numberOfLines={1}>
                        {currentEvent.appName}
                      </ListGroup.ItemTitle>
                      {currentEvent.windowTitle ? (
                        <Text className="text-neutral-500 text-xs mt-0.5" numberOfLines={1}>
                          {currentEvent.windowTitle}
                        </Text>
                      ) : null}
                      <Text className="text-neutral-600 text-xs font-mono mt-1" numberOfLines={1}>
                        {currentEvent.bundleId}
                      </Text>
                    </ListGroup.ItemContent>
                    <ListGroup.ItemSuffix>
                      <Text className="text-neutral-500 text-xs font-mono">
                        {formatEventTime(currentEvent.timestamp)}
                      </Text>
                    </ListGroup.ItemSuffix>
                  </ListGroup.Item>
                </>
              )}
            </ListGroup>
          </View>
        )}

        {/* VERSION FOOTER */}
        <Pressable className="mt-10 mb-8 items-center" onPress={handleVersionTap}>
          <Text className="text-neutral-600 text-xs">Chrona</Text>
        </Pressable>
      </AnimatedHeaderScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chevron: {
    width: 13,
    height: 13,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
