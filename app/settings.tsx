import { AnimatedHeaderScrollView } from "@/components/animated-header-scroll-view";
import { StaticAuraBackground } from "@/features/aurora/static-aura-background";
import { DevBadge, SoonBadge } from "@/components/wip-badge";
import { useAuroraTheme } from "@/features/aurora/use-aurora-theme";
import { checkAwAvailability, getCurrentApp } from "@/features/activity-watch/aw-adapter";
import { calendarStatusLabel } from "@/features/calendar/calendar";
import { useCalendarStore } from "@/features/calendar/calendar-store";
import { useSettingsStore, type TimerStartMode } from "@/features/settings/settings-store";
import { useTrackingRulesStore } from "@/features/tracking-rules/tracking-rules-store";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { Switch } from "heroui-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, Keyboard } from "react-native";

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
  const {
    auroraEnabled,
    setAuroraEnabled,
    constellationEnabled,
    setConstellationEnabled,
    developerMode,
    setDeveloperMode,
    awAdapterMode,
    setAwAdapterMode,
    awStreamHost,
    setAwStreamHost,
    timerStartMode,
  } = useSettingsStore();

  const TIMER_MODE_LABELS: Record<TimerStartMode, string> = {
    a: "Conversational",
    b: "Hold to Start",
    c: "Project First",
  };
  const { rules } = useTrackingRulesStore();
  const [devTapCount, setDevTapCount] = useState(0);
  const [awAvailable, setAwAvailable] = useState<boolean | null>(null);
  const [activeApp, setActiveApp] = useState<{ app: string; title: string | null } | null>(null);

  useEffect(() => {
    setAwAvailable(null);
    checkAwAvailability().then(setAwAvailable);
  }, [awAdapterMode]);

  useEffect(() => {
    let cancelled = false;
    const poll = () => getCurrentApp().then((r) => { if (!cancelled) setActiveApp(r); });
    poll();
    const id = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  function handleAwModeToggle(streamEnabled: boolean) {
    setAwAdapterMode(streamEnabled ? "stream" : "localhost");
  }

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
              label="Activity Tracking"
              suffix={
                <Text className="text-neutral-500 text-sm">
                  {awAvailable === null
                    ? "Checking..."
                    : awAvailable
                      ? "Connected"
                      : awAdapterMode === "stream"
                        ? "Waiting for stream"
                        : "Not Available"}
                </Text>
              }
            />
            <SettingsDivider />
            <View className="flex-row items-center justify-between py-4 px-5">
              <View className="flex-row items-center gap-2 flex-1">
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: activeApp ? "#4ade80" : "#3f3f46",
                  }}
                />
                <Text className="text-white text-base font-medium">Active App</Text>
              </View>
              <View className="items-end" style={{ maxWidth: "55%" }}>
                {activeApp ? (
                  <>
                    <Text className="text-white text-sm font-medium" numberOfLines={1}>
                      {activeApp.app}
                    </Text>
                    {activeApp.title ? (
                      <Text className="text-neutral-500 text-xs mt-0.5" numberOfLines={1}>
                        {activeApp.title}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text className="text-neutral-600 text-sm">—</Text>
                )}
              </View>
            </View>
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

        {/* DEVELOPER */}
        {developerMode && (
          <View className="mt-10">
            <SectionLabel>Developer</SectionLabel>
            <SettingsCard>
              <SettingsRow
                label="Stream Mode"
                suffix={
                  <View className="flex-row items-center gap-3">
                    <DevBadge />
                    <Text className="text-xs text-neutral-500">
                      {awAdapterMode === "stream" ? "P2P · collector" : "localhost:5600"}
                    </Text>
                    <Switch
                      isSelected={awAdapterMode === "stream"}
                      onSelectedChange={handleAwModeToggle}
                    />
                  </View>
                }
              />
              {awAdapterMode === "stream" && (
                <>
                  <SettingsDivider />
                  <View className="flex-row items-center justify-between py-4 px-5">
                    <Text className="text-white text-base font-medium flex-1">
                      Collector Host
                    </Text>
                    <TextInput
                      value={awStreamHost}
                      onChangeText={setAwStreamHost}
                      placeholder="localhost"
                      placeholderTextColor="#52525b"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      style={{
                        color: "#a1a1aa",
                        fontSize: 14,
                        textAlign: "right",
                        minWidth: 140,
                      }}
                    />
                  </View>
                </>
              )}
              <SettingsDivider />
              <SettingsRow
                label="Tracking Rules"
                onPress={() => router.push("/tracking-rules")}
                suffix={
                  <View className="flex-row items-center gap-2">
                    <SoonBadge />
                    <ValueSuffix
                      value={`${rules.length} rule${rules.length !== 1 ? "s" : ""}`}
                    />
                  </View>
                }
              />
            </SettingsCard>
          </View>
        )}

        {/* VERSION FOOTER — tap 5× to unlock developer mode */}
        <Pressable
          className="mt-10 mb-8 items-center"
          onPress={() => {
            setDevTapCount((prev) => {
              const next = prev + 1;
              if (next === 5) {
                setDeveloperMode(!developerMode);
                return 0;
              }
              return next % 6;
            });
          }}
        >
          <Text className="text-neutral-600 text-xs">Focus</Text>
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
});
