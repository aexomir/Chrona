import { Image } from "expo-image";
import { useRouter, Stack } from "expo-router";
import { Switch } from "heroui-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCalendarStore } from "@/stores/calendar-store";
import { calendarStatusLabel } from "@/lib/calendar";
import { useMeetingStore } from "@/stores/meeting-store";
import { meetingStatusLabel } from "@/lib/meetingDetection";
import { useSettingsStore } from "@/stores/settings-store";
import { useTrackingRulesStore } from "@/stores/tracking-rules-store";
import { StaticAuraBackground } from "@/components/static-aura-background";
import { useAuroraTheme } from "@/hooks/use-aurora-theme";
import { AnimatedHeaderScrollView } from "@/components/animated-header-scroll-view";
import { SoonBadge } from "@/components/wip-badge";
import { useState } from "react";

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
  const { isEnabled: meetingEnabled, selectedAppIds } = useMeetingStore();
  const {
    auroraEnabled,
    setAuroraEnabled,
    constellationEnabled,
    setConstellationEnabled,
    developerMode,
    setDeveloperMode,
  } = useSettingsStore();
  const { rules } = useTrackingRulesStore();
  const [devTapCount, setDevTapCount] = useState(0);

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
        {/* ATMOSPHERE */}
        <SectionLabel>Atmosphere</SectionLabel>
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
        </SettingsCard>

        {/* INTEGRATIONS */}
        <View className="mt-10">
          <SectionLabel>Integrations</SectionLabel>
          <SettingsCard>
            <SettingsRow
              label="Calendar"
              onPress={() => router.push("/calendar-settings")}
              suffix={
                <ValueSuffix value={calendarStatusLabel(permissionStatus, isEnabled)} />
              }
            />
            {developerMode && (
              <>
                <SettingsDivider />
                <SettingsRow
                  label="Meetings"
                  onPress={() => router.push("/meeting-settings")}
                  suffix={
                    <View className="flex-row items-center gap-2">
                      <SoonBadge />
                      <ValueSuffix
                        value={meetingStatusLabel(meetingEnabled, selectedAppIds)}
                      />
                    </View>
                  }
                />
              </>
            )}
            {developerMode && (
              <>
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
              </>
            )}
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
            <SettingsDivider />
            <SettingsRow
              label="Export Data"
              onPress={() => {}}
              suffix={<ChevronSuffix />}
            />
          </SettingsCard>
        </View>

        {/* ABOUT */}
        <View className="mt-10 mb-8">
          <Pressable
            onPress={() => {
              setDevTapCount((prev) => {
                const next = prev + 1;
                if (next === 5) {
                  setDeveloperMode(!developerMode);
                  setDevTapCount(0);
                }
                return next % 6;
              });
            }}
          >
            <SectionLabel>About</SectionLabel>
          </Pressable>
          <SettingsCard>
            <SettingsRow
              label="Privacy Policy"
              onPress={() => {}}
              suffix={<ChevronSuffix />}
            />
            <SettingsDivider />
            <SettingsRow
              label="Rate Focus"
              onPress={() => {}}
              suffix={<ChevronSuffix />}
            />
            <SettingsDivider />
            <SettingsRow
              label="Contact"
              onPress={() => {}}
              suffix={<ChevronSuffix />}
            />
          </SettingsCard>
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
