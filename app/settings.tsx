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
import { Switch } from "heroui-native";

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
  suffix,
  children,
}: {
  label: string;
  onPress?: () => void;
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

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
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

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useAuroraTheme();
  const { permissionStatus, isEnabled } = useCalendarStore();
  const streamStatus = useStreamStore((s) => s.status);
  const {
    auroraEnabled,
    setAuroraEnabled,
    constellationEnabled,
    setConstellationEnabled,
    timerStartMode,
  } = useSettingsStore();

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

        {/* VERSION FOOTER */}
        <View className="mt-10 mb-8 items-center">
          <Text className="text-neutral-600 text-xs">Chrona</Text>
        </View>
      </AnimatedHeaderScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chevron: {
    width: 13,
    height: 13,
  },
});
