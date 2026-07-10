import { useRef } from "react";
import { AnimatedHeaderScrollView } from "@/components/animated-header-scroll-view";
import { StaticAuraBackground } from "@/features/aurora/static-aura-background";
import { useAuroraTheme } from "@/features/aurora/use-aurora-theme";
import { calendarStatusLabel } from "@/features/calendar/calendar";
import { useCalendarStore } from "@/features/calendar/calendar-store";
import { useSettingsStore, type TimerStartMode } from "@/features/settings/settings-store";
import { useStreamStore } from "@/features/stream/stream-store";
import type { ConnectionStatus } from "@/modules/chrona-stream";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { PortalHost, Select, Switch } from "heroui-native";

import { Pressable, StyleSheet, Text, View } from "react-native";

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs text-neutral-500 uppercase tracking-widest mb-3 ml-0">
      {children}
    </Text>
  );
}

function ValueSuffix({ value }: { value: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <Text className="text-neutral-500 text-sm">{value}</Text>
      <Image
        source="sf:chevron.right"
        style={styles.chevron}
        tintColor="#636366"
      />
    </View>
  );
}

function ChevronSuffix() {
  return (
    <Image
      source="sf:chevron.right"
      style={styles.chevron}
      tintColor="#636366"
    />
  );
}

function SettingsRow({
  label,
  onPress,
  onLongPress,
  suffix,
  children,
}: {
  label: string;
  onPress?: () => void;
  onLongPress?: () => void;
  suffix?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const content = (
    <View
      className="flex-row items-center justify-between py-4 px-5"
      style={{ backgroundColor: "transparent" }}
    >
      <Text className="text-white text-base font-medium flex-1">{label}</Text>
      {suffix && <View>{suffix}</View>}
      {children}
    </View>
  );

  if (onPress || onLongPress) {
    return <Pressable onPress={onPress} onLongPress={onLongPress}>{content}</Pressable>;
  }
  return content;
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  const theme = useAuroraTheme();
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.cardBorder,
        backgroundColor: theme.card,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

type SelectOption = { value: string; label: string };

const MIN_DURATION_OPTIONS: SelectOption[] = [
  { value: "0", label: "Off" },
  { value: "30", label: "30 seconds" },
  { value: "60", label: "1 minute" },
  { value: "120", label: "2 minutes" },
  { value: "300", label: "5 minutes" },
];

const MAC_STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string }> = {
  idle: { label: "Off", color: "#52525b" },
  scanning: { label: "Searching…", color: "#d97706" },
  connecting: { label: "Connecting…", color: "#d97706" },
  connected: { label: "Connected", color: "#22c55e" },
  disconnected: { label: "Not Found", color: "#52525b" },
};

function MacHelperStatus({ status }: { status: ConnectionStatus }) {
  const { label, color } = MAC_STATUS_CONFIG[status];
  return (
    <View className="flex-row items-center gap-2">
      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color }} />
      <Text style={{ color, fontSize: 14 }}>{label}</Text>
      <Image source="sf:arrow.clockwise" style={styles.chevron} tintColor="#636366" />
    </View>
  );
}

function SettingsDivider() {
  const theme = useAuroraTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.cardBorder,
        marginLeft: 20,
      }}
    />
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
  const router = useRouter();
  const theme = useAuroraTheme();
  const { permissionStatus, isEnabled } = useCalendarStore();
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
    timerStartMode,
    autoTrackMinDurationSec,
    setAutoTrackMinDurationSec,
    developerMode,
    setDeveloperMode,
  } = useSettingsStore();

  const devTapCount = useRef(0);
  const devTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVersionTap = () => {
    devTapCount.current += 1;
    if (devTapTimer.current) clearTimeout(devTapTimer.current);
    if (devTapCount.current >= 5) {
      devTapCount.current = 0;
      setDeveloperMode(!developerMode);
      return;
    }
    devTapTimer.current = setTimeout(() => { devTapCount.current = 0; }, 2000);
  };

  const currentMinDuration =
    MIN_DURATION_OPTIONS.find((o) => o.value === autoTrackMinDurationSec.toString()) ??
    MIN_DURATION_OPTIONS[2];

  const TIMER_MODE_LABELS: Record<TimerStartMode, string> = {
    a: "Conversational",
    b: "Hold to Start",
    c: "Project First",
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
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
        <SettingsCard>
          <SettingsRow
            label="Aurora Theme"
            suffix={
              <Switch
                isSelected={auroraEnabled}
                onSelectedChange={setAuroraEnabled}
              />
            }
          />
          <SettingsDivider />
          <SettingsRow
            label="Constellation"
            suffix={
              <Switch
                isSelected={constellationEnabled}
                onSelectedChange={setConstellationEnabled}
              />
            }
          />
          <SettingsDivider />
          <SettingsRow
            label="Timer Style"
            onPress={() => router.push("/timer-style")}
            suffix={<ValueSuffix value={TIMER_MODE_LABELS[timerStartMode]} />}
          />
        </SettingsCard>

        {/* INTEGRATIONS */}
        <View className="mt-10">
          <SectionLabel>Integrations</SectionLabel>
          <SettingsCard>
            <SettingsRow
              label="Mac Helper"
              onPress={reconnect}
              onLongPress={() => { clearEndpointCache(); reconnect(); }}
              suffix={<MacHelperStatus status={streamStatus} />}
            />
            <SettingsDivider />
            <SettingsRow
              label="Calendar"
              onPress={() => router.push("/calendar-settings")}
              suffix={
                <ValueSuffix
                  value={calendarStatusLabel(permissionStatus, isEnabled)}
                />
              }
            />
            <SettingsDivider />
            <SettingsRow
              label="Tracking Rules"
              onPress={() => router.push("/tracking-rules")}
              suffix={<ChevronSuffix />}
            />
            <SettingsDivider />
            <Select
              value={currentMinDuration}
              onValueChange={(v) => {
                if (v) setAutoTrackMinDurationSec(Number((v as SelectOption).value));
              }}
            >
              <Select.Trigger className="bg-transparent shadow-none border-0 rounded-none px-5 py-4">
                <Text className="text-white text-base font-medium flex-1">
                  Min. Session Length
                </Text>
                <View className="flex-row items-center gap-1">
                  <Text className="text-neutral-500 text-sm">
                    {currentMinDuration.label}
                  </Text>
                  <Image
                    source="sf:chevron.right"
                    style={styles.chevron}
                    tintColor="#636366"
                  />
                </View>
              </Select.Trigger>
              <Select.Portal hostName="settings">
                <Select.Overlay />
                <Select.Content
                  presentation="popover"
                  width="trigger"
                  className="border border-white/10 shadow-none"
                  style={{ backgroundColor: "#18181b" }}
                >
                  <Select.ListLabel>Min. Session Length</Select.ListLabel>
                  {MIN_DURATION_OPTIONS.map((opt) => (
                    <Select.Item key={opt.value} value={opt.value} label={opt.label}>
                      <Select.ItemLabel />
                      <Select.ItemIndicator />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Portal>
            </Select>
          </SettingsCard>
        </View>

        {/* DATA */}
        <View className="mt-10">
          <SectionLabel>Data</SectionLabel>
          <SettingsCard>
            <SettingsRow
              label="Projects"
              onPress={() => router.push("/projects")}
              suffix={<ChevronSuffix />}
            />
          </SettingsCard>
        </View>

        {/* DBG */}
        {developerMode && (
          <View className="mt-10">
            <SectionLabel>DBG</SectionLabel>
            <SettingsCard>
              <SettingsRow
                label="Status"
                suffix={
                  <Text className="text-neutral-400 text-sm font-mono">{streamStatus}</Text>
                }
              />
              <SettingsDivider />
              <SettingsRow
                label="Network"
                suffix={
                  <Text className={`text-sm font-mono ${pathSatisfied ? "text-green-500" : "text-neutral-500"}`}>
                    {pathSatisfied ? "satisfied" : "unsatisfied"}
                  </Text>
                }
              />
              <SettingsDivider />
              <SettingsRow
                label="Last Received"
                suffix={
                  <Text className="text-neutral-400 text-sm font-mono">{formatTimestamp(lastEventTime)}</Text>
                }
              />
              <SettingsDivider />
              <SettingsRow
                label="Last Heartbeat"
                suffix={
                  <Text className="text-neutral-400 text-sm font-mono">{formatTimestamp(lastHeartbeat)}</Text>
                }
              />
              {currentEvent && (
                <>
                  <SettingsDivider />
                  <View className="py-3 px-5">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white text-sm font-medium flex-1" numberOfLines={1}>
                        {currentEvent.appName}
                      </Text>
                      <Text className="text-neutral-500 text-xs font-mono ml-3">
                        {formatEventTime(currentEvent.timestamp)}
                      </Text>
                    </View>
                    {currentEvent.windowTitle ? (
                      <Text className="text-neutral-500 text-xs mt-0.5" numberOfLines={1}>
                        {currentEvent.windowTitle}
                      </Text>
                    ) : null}
                    <Text className="text-neutral-600 text-xs font-mono mt-1" numberOfLines={1}>
                      {currentEvent.bundleId}
                    </Text>
                  </View>
                </>
              )}
            </SettingsCard>
          </View>
        )}

        {/* VERSION FOOTER */}
        <Pressable className="mt-10 mb-8 items-center" onPress={handleVersionTap}>
          <Text className="text-neutral-600 text-xs">Chrona</Text>
        </Pressable>
      </AnimatedHeaderScrollView>
      <PortalHost name="settings" />
    </View>
  );
}

const styles = StyleSheet.create({
  chevron: {
    width: 13,
    height: 13,
  },
});
