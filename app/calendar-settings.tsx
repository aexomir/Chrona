import { SectionLabel } from "@/components/section-label";
import { Neutral } from "@/constants/theme";
import { useAuroraTheme } from "@/features/aurora/use-aurora-theme";
import {
  calendarStatusLabel,
  getCalendars,
  type CalendarInfo,
} from "@/features/calendar/calendar";
import {
  CALENDAR_REFRESH_INTERVAL_MS,
  useCalendarStore,
} from "@/features/calendar/calendar-store";
import { useProjects } from "@/features/projects/projects-store";
import { useAppToast } from "@/hooks/use-app-toast";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import {
  Button,
  ListGroup,
  PortalHost,
  Select,
  Separator,
  Switch,
} from "heroui-native";
import { useCallback, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type SelectOption = { value: string; label: string };
type CalendarRow = { id: string; name: string; orphaned: boolean };

const UNTRACKED = "__untracked__";
const REFRESH_INTERVAL_MINUTES = CALENDAR_REFRESH_INTERVAL_MS / 60_000;

function formatSyncedAt(iso: string | null): string {
  if (!iso) return "Not synced yet";
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (minutes < 1) return "Synced just now";
  if (minutes < 60) return `Synced ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  return `Synced ${Math.round(hours / 24)}d ago`;
}

export default function CalendarSettingsScreen() {
  const theme = useAuroraTheme();
  const toast = useAppToast();
  const { projects } = useProjects();
  const permissionStatus = useCalendarStore((s) => s.permissionStatus);
  const isEnabled = useCalendarStore((s) => s.isEnabled);
  const mappings = useCalendarStore((s) => s.mappings);
  const eventsLastFetched = useCalendarStore((s) => s.eventsLastFetched);
  const syncPermissionStatus = useCalendarStore((s) => s.syncPermissionStatus);
  const requestPermission = useCalendarStore((s) => s.requestPermission);
  const setEnabled = useCalendarStore((s) => s.setEnabled);
  const fetchEvents = useCalendarStore((s) => s.fetchEvents);
  const setCalendarProject = useCalendarStore((s) => s.setCalendarProject);

  const [availableCalendars, setAvailableCalendars] = useState<CalendarInfo[]>(
    [],
  );

  useFocusEffect(
    useCallback(() => {
      syncPermissionStatus();
      if (permissionStatus === "granted") {
        getCalendars().then(setAvailableCalendars);
      }
    }, [permissionStatus, syncPermissionStatus]),
  );

  // Calendars currently reported by the OS, plus any mapped calendar that no
  // longer comes back (deleted/renamed) so its rule stays visible and removable.
  const calendarRows = useMemo<CalendarRow[]>(() => {
    const knownIds = new Set(availableCalendars.map((c) => c.id));
    const orphanRows = mappings
      .filter((m) => !knownIds.has(m.calendarId))
      .map((m) => ({ id: m.calendarId, name: m.calendarName, orphaned: true }));
    return [
      ...availableCalendars.map((c) => ({ id: c.id, name: c.name, orphaned: false })),
      ...orphanRows,
    ];
  }, [availableCalendars, mappings]);

  async function handleGrantAccess() {
    if (permissionStatus === "denied") {
      Linking.openSettings();
    } else {
      const status = await requestPermission();
      if (status === "granted") {
        const calendars = await getCalendars();
        setAvailableCalendars(calendars);
      } else {
        toast.show({
          label: "Calendar access required — enable in Settings",
          variant: "warning",
        });
      }
    }
  }

  async function handleRefreshEvents() {
    const success = await fetchEvents();
    if (!success) {
      toast.show({
        label: "Failed to sync calendar events",
        variant: "danger",
      });
    }
  }

  function handleAssign(calendar: CalendarRow, value: string) {
    const projectId = value === UNTRACKED ? null : value;
    setCalendarProject(calendar.id, calendar.name, projectId);
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1"
      style={{ backgroundColor: theme.modalSheet }}
      contentContainerClassName="px-5 pb-10"
    >
      <Text className="text-white text-4xl font-bold mt-8 mb-4">Calendar</Text>
      <Text className="text-neutral-500 text-sm mb-8 leading-relaxed">
        Chrona shows your calendar events on your Timeline. Assign a project to
        a calendar to also get a one-tap suggestion to start tracking while an
        event from it is happening.
      </Text>

      {/* ACCESS SECTION */}
      <SectionLabel>Access</SectionLabel>
      <ListGroup className={`mb-8 ${theme.listGroupClassName}`}>
        <ListGroup.Item>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>Calendar Access</ListGroup.ItemTitle>
            <Text className="text-zinc-400 text-xs mt-1">
              {calendarStatusLabel(permissionStatus, isEnabled)}
            </Text>
          </ListGroup.ItemContent>
          {permissionStatus !== "granted" && (
            <ListGroup.ItemSuffix>
              <Button variant="primary" size="sm" onPress={handleGrantAccess}>
                <Button.Label>
                  {permissionStatus === "denied" ? "Settings" : "Grant"}
                </Button.Label>
              </Button>
            </ListGroup.ItemSuffix>
          )}
        </ListGroup.Item>
      </ListGroup>

      {/* INTEGRATION SECTION */}
      {permissionStatus === "granted" && (
        <>
          <SectionLabel>Integration</SectionLabel>
          <ListGroup className={`mb-2 ${theme.listGroupClassName}`}>
            <ListGroup.Item>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>Enable Calendar</ListGroup.ItemTitle>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix>
                <Switch isSelected={isEnabled} onSelectedChange={setEnabled} />
              </ListGroup.ItemSuffix>
            </ListGroup.Item>
          </ListGroup>

          {isEnabled && (
            <View className="flex-row items-center justify-between mb-8 px-1">
              <Text className="text-zinc-600 text-xs">
                {formatSyncedAt(eventsLastFetched)} · refreshes automatically
                every {REFRESH_INTERVAL_MINUTES} minutes
              </Text>
              <Pressable onPress={handleRefreshEvents} hitSlop={8}>
                <Text className="text-blue-500 text-xs font-semibold">
                  Refresh
                </Text>
              </Pressable>
            </View>
          )}
        </>
      )}

      {/* CALENDARS SECTION */}
      {permissionStatus === "granted" && isEnabled && (
        <>
          <SectionLabel>Calendars</SectionLabel>
          {calendarRows.length === 0 ? (
            <Text className="text-neutral-500 text-center text-sm mb-6">
              No calendars found on this device.
            </Text>
          ) : (
            <ListGroup className={theme.listGroupClassName}>
              {calendarRows.map((calendar, index) => {
                const mapping = mappings.find(
                  (m) => m.calendarId === calendar.id,
                );
                const project = mapping
                  ? projects.find((p) => p.id === mapping.projectId)
                  : undefined;

                return (
                  <View key={calendar.id}>
                    {index > 0 && <Separator className="mx-4" />}
                    <ListGroup.Item>
                      <ListGroup.ItemPrefix>
                        <View
                          style={[
                            styles.projectBadge,
                            { backgroundColor: project?.color ?? Neutral.z700 },
                          ]}
                        >
                          <Image
                            source={`sf:${project?.icon ?? "calendar"}`}
                            style={styles.iconSm}
                            tintColor="#fff"
                          />
                        </View>
                      </ListGroup.ItemPrefix>
                      <ListGroup.ItemContent>
                        <ListGroup.ItemTitle>
                          {calendar.name}
                        </ListGroup.ItemTitle>
                        {calendar.orphaned && (
                          <Text className="text-neutral-600 text-xs mt-1">
                            Calendar no longer available
                          </Text>
                        )}
                      </ListGroup.ItemContent>
                      <ListGroup.ItemSuffix>
                        <Select
                          value={{
                            value: mapping?.projectId ?? UNTRACKED,
                            label: project?.name ?? "Not tracked",
                          }}
                          onValueChange={(v) =>
                            v &&
                            handleAssign(calendar, (v as SelectOption).value)
                          }
                        >
                          <Select.Trigger className="bg-transparent shadow-none border border-white/10 px-3 py-1.5">
                            <Text
                              className={
                                project
                                  ? "text-white text-xs"
                                  : "text-zinc-500 text-xs"
                              }
                            >
                              {project?.name ?? "Not tracked"}
                            </Text>
                            <Select.TriggerIndicator />
                          </Select.Trigger>
                          <Select.Portal hostName="calendar-settings">
                            <Select.Overlay />
                            <Select.Content
                              presentation="popover"
                              width={220}
                              className="border border-white/10 shadow-none"
                              style={{ backgroundColor: Neutral.z900 }}
                            >
                              <Select.ListLabel>Track as</Select.ListLabel>
                              <Select.Item
                                value={UNTRACKED}
                                label="Not tracked"
                              >
                                <Select.ItemLabel />
                                <Select.ItemIndicator />
                              </Select.Item>
                              {projects.map((p) => (
                                <Select.Item
                                  key={p.id}
                                  value={p.id}
                                  label={p.name}
                                >
                                  <View className="flex-row items-center gap-3 flex-1">
                                    <Image
                                      source={`sf:${p.icon}`}
                                      style={styles.icon}
                                      tintColor={p.color}
                                    />
                                    <Select.ItemLabel />
                                  </View>
                                  <Select.ItemIndicator />
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select.Portal>
                        </Select>
                      </ListGroup.ItemSuffix>
                    </ListGroup.Item>
                  </View>
                );
              })}
            </ListGroup>
          )}

          <PortalHost name="calendar-settings" />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 18,
    height: 18,
  },
  projectBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  iconSm: {
    width: 16,
    height: 16,
  },
});
