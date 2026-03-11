import {
  calendarStatusLabel,
  getCalendars,
  type CalendarInfo,
} from "@/lib/calendar";
import { useCalendarStore } from "@/stores/calendar-store";
import { useProjects } from "@/stores/projects-store";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { ListGroup, PortalHost, Select, Separator } from "heroui-native";
import { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type SelectOption = { value: string; label: string };
type SignalType = "calendarName" | "titleKeyword";

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs text-neutral-500 uppercase tracking-widest mb-2 ml-1">
      {children}
    </Text>
  );
}

export default function CalendarSettingsScreen() {
  const { projects } = useProjects();
  const {
    permissionStatus,
    isEnabled,
    mappings,
    syncPermissionStatus,
    requestPermission,
    setEnabled,
    fetchEvents,
    addMapping,
    removeMapping,
  } = useCalendarStore();

  const [availableCalendars, setAvailableCalendars] = useState<CalendarInfo[]>(
    [],
  );
  const [addMappingModalVisible, setAddMappingModalVisible] = useState(false);
  const [signalType, setSignalType] = useState<SignalType>("calendarName");
  const [selectedCalendar, setSelectedCalendar] = useState<CalendarInfo | null>(
    null,
  );
  const [titleKeywords, setTitleKeywords] = useState("");
  const [selectedProject, setSelectedProject] = useState<
    SelectOption | undefined
  >();

  useFocusEffect(
    useCallback(() => {
      syncPermissionStatus();
      if (permissionStatus === "granted") {
        getCalendars().then(setAvailableCalendars);
      }
    }, [permissionStatus, syncPermissionStatus]),
  );

  function openAddMappingModal() {
    setSignalType("calendarName");
    setSelectedCalendar(null);
    setTitleKeywords("");
    setSelectedProject(undefined);
    setAddMappingModalVisible(true);
  }

  function saveMapping() {
    if (!selectedProject) return;

    if (signalType === "calendarName") {
      if (!selectedCalendar) return;
      addMapping({
        projectId: selectedProject.value,
        calendarName: selectedCalendar.name,
      });
    } else {
      const keywords = titleKeywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
      if (keywords.length === 0) return;
      addMapping({
        projectId: selectedProject.value,
        titleKeywords: keywords,
      });
    }

    setAddMappingModalVisible(false);
  }

  function removeMapping_(id: string) {
    Alert.alert("Delete Mapping", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => removeMapping(id),
      },
    ]);
  }

  async function handleGrantAccess() {
    if (permissionStatus === "denied") {
      Linking.openSettings();
    } else {
      await requestPermission();
      if (permissionStatus === "granted") {
        const calendars = await getCalendars();
        setAvailableCalendars(calendars);
      }
    }
  }

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1 bg-[#111113]"
        contentContainerClassName="px-5 pb-10"
      >
        <Text className="text-white text-4xl font-bold mt-8 mb-8">Calendar</Text>

        {/* ACCESS SECTION */}
        <SectionLabel>Access</SectionLabel>
        <ListGroup className="mb-8">
          <ListGroup.Item>
            <ListGroup.ItemContent>
              <ListGroup.ItemTitle>Calendar Access</ListGroup.ItemTitle>
              <Text className="text-zinc-400 text-xs mt-1">
                {calendarStatusLabel(permissionStatus, isEnabled)}
              </Text>
            </ListGroup.ItemContent>
            {permissionStatus !== "granted" && (
              <ListGroup.ItemSuffix>
                <TouchableOpacity
                  onPress={handleGrantAccess}
                  className="px-3 py-2 rounded-lg bg-blue-600"
                >
                  <Text className="text-white text-xs font-semibold">
                    {permissionStatus === "denied" ? "Settings" : "Grant"}
                  </Text>
                </TouchableOpacity>
              </ListGroup.ItemSuffix>
            )}
          </ListGroup.Item>
        </ListGroup>

        {/* INTEGRATION SECTION */}
        {permissionStatus === "granted" && (
          <>
            <SectionLabel>Integration</SectionLabel>
            <ListGroup className="mb-8">
              <ListGroup.Item>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>Enable Calendar</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix>
                  <Switch
                    value={isEnabled}
                    onValueChange={setEnabled}
                    trackColor={{ false: "#3a3a3c", true: "#3b82f6" }}
                    thumbColor={isEnabled ? "#fff" : "#8e8e93"}
                  />
                </ListGroup.ItemSuffix>
              </ListGroup.Item>

              {isEnabled && (
                <>
                  <Separator className="mx-4" />
                  <ListGroup.Item onPress={() => fetchEvents()}>
                    <ListGroup.ItemContent>
                      <ListGroup.ItemTitle>Refresh Events</ListGroup.ItemTitle>
                    </ListGroup.ItemContent>
                    <ListGroup.ItemSuffix>
                      <Image
                        source="sf:arrow.clockwise"
                        style={styles.icon}
                        tintColor="#3b82f6"
                      />
                    </ListGroup.ItemSuffix>
                  </ListGroup.Item>
                </>
              )}
            </ListGroup>
          </>
        )}

        {/* PROJECT MAPPINGS SECTION */}
        {permissionStatus === "granted" && isEnabled && (
          <>
            <SectionLabel>Project Mappings</SectionLabel>
            {mappings.length === 0 ? (
              <Text className="text-neutral-500 text-center text-sm mb-6">
                No mappings yet. Add one to match calendar events to projects.
              </Text>
            ) : (
              <ListGroup className="mb-6">
                {mappings.map((mapping, index) => {
                  const project = projects.find(
                    (p) => p.id === mapping.projectId,
                  );
                  if (!project) return null;

                  const description = mapping.calendarName
                    ? mapping.calendarName
                    : mapping.titleKeywords?.join(", ");

                  return (
                    <View key={mapping.id}>
                      {index > 0 && <Separator className="mx-4" />}
                      <ListGroup.Item>
                        <ListGroup.ItemPrefix>
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              backgroundColor: project.color,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Image
                              source={`sf:${project.icon}`}
                              style={{ width: 16, height: 16 }}
                              tintColor="#fff"
                            />
                          </View>
                        </ListGroup.ItemPrefix>
                        <ListGroup.ItemContent>
                          <ListGroup.ItemTitle>{project.name}</ListGroup.ItemTitle>
                          <Text className="text-zinc-500 text-xs mt-1">
                            {description}
                          </Text>
                        </ListGroup.ItemContent>
                        <ListGroup.ItemSuffix>
                          <TouchableOpacity
                            onPress={() => removeMapping_(mapping.id)}
                            className="p-2"
                          >
                            <Image
                              source="sf:trash"
                              style={{ width: 16, height: 16 }}
                              tintColor="#ef4444"
                            />
                          </TouchableOpacity>
                        </ListGroup.ItemSuffix>
                      </ListGroup.Item>
                    </View>
                  );
                })}
              </ListGroup>
            )}

            <ListGroup>
              <ListGroup.Item onPress={openAddMappingModal}>
                <ListGroup.ItemPrefix>
                  <Image
                    source="sf:plus.circle.fill"
                    style={{ width: 20, height: 20 }}
                    tintColor="#3b82f6"
                  />
                </ListGroup.ItemPrefix>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle className="text-blue-500">
                    Add Mapping
                  </ListGroup.ItemTitle>
                </ListGroup.ItemContent>
              </ListGroup.Item>
            </ListGroup>
          </>
        )}
      </ScrollView>

      {/* ADD MAPPING MODAL */}
      <Modal
        visible={addMappingModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddMappingModalVisible(false)}
      >
        <View className="flex-1 bg-[#111113] px-5 pt-6">
          <View className="flex-row items-center justify-between mb-8">
            <TouchableOpacity onPress={() => setAddMappingModalVisible(false)}>
              <Text className="text-neutral-400 text-base">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-white text-base font-semibold">
              Add Mapping
            </Text>
            <TouchableOpacity onPress={saveMapping}>
              <Text
                className={`text-base font-semibold ${
                  !selectedProject
                    ? "text-neutral-600"
                    : signalType === "calendarName"
                      ? !selectedCalendar
                        ? "text-neutral-600"
                        : "text-blue-500"
                      : titleKeywords.trim().length === 0
                        ? "text-neutral-600"
                        : "text-blue-500"
                }`}
              >
                Save
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentInsetAdjustmentBehavior="automatic">
            <Text className="text-xs text-neutral-500 uppercase tracking-widest mb-3 ml-1">
              Signal Type
            </Text>
            <View className="flex-row gap-3 mb-8">
              <TouchableOpacity
                onPress={() => setSignalType("calendarName")}
                className={`flex-1 p-4 rounded-xl border ${
                  signalType === "calendarName"
                    ? "bg-blue-600 border-blue-500"
                    : "bg-[#1c1c1e] border-zinc-800"
                }`}
              >
                <Text
                  className={`text-center font-semibold text-sm ${
                    signalType === "calendarName"
                      ? "text-white"
                      : "text-zinc-400"
                  }`}
                >
                  Calendar Name
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSignalType("titleKeyword")}
                className={`flex-1 p-4 rounded-xl border ${
                  signalType === "titleKeyword"
                    ? "bg-blue-600 border-blue-500"
                    : "bg-[#1c1c1e] border-zinc-800"
                }`}
              >
                <Text
                  className={`text-center font-semibold text-sm ${
                    signalType === "titleKeyword"
                      ? "text-white"
                      : "text-zinc-400"
                  }`}
                >
                  Title Keyword
                </Text>
              </TouchableOpacity>
            </View>

            {signalType === "calendarName" && (
              <>
                <Text className="text-xs text-neutral-500 uppercase tracking-widest mb-3 ml-1">
                  Calendar
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-8">
                  {availableCalendars.map((cal) => (
                    <TouchableOpacity
                      key={cal.id}
                      onPress={() => setSelectedCalendar(cal)}
                      className={`px-4 py-2 rounded-full border ${
                        selectedCalendar?.id === cal.id
                          ? "bg-blue-600 border-blue-500"
                          : "bg-[#1c1c1e] border-zinc-800"
                      }`}
                    >
                      <Text
                        className={
                          selectedCalendar?.id === cal.id
                            ? "text-white text-xs font-semibold"
                            : "text-zinc-400 text-xs"
                        }
                      >
                        {cal.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {signalType === "titleKeyword" && (
              <>
                <Text className="text-xs text-neutral-500 uppercase tracking-widest mb-3 ml-1">
                  Keywords (comma-separated)
                </Text>
                <TextInput
                  value={titleKeywords}
                  onChangeText={setTitleKeywords}
                  placeholder="e.g., meeting, standup, review"
                  placeholderTextColor="#636366"
                  className="bg-[#1c1c1e] text-white px-4 py-3 rounded-xl text-base mb-8"
                  multiline
                />
              </>
            )}

            <Text className="text-xs text-neutral-500 uppercase tracking-widest mb-3 ml-1">
              Project
            </Text>
            <View className="mb-6">
              <Select
                value={selectedProject}
                onValueChange={(v) =>
                  setSelectedProject(v as SelectOption | undefined)
                }
              >
                <Select.Trigger>
                  <Text className="text-white flex-1">
                    {selectedProject
                      ? projects.find((p) => p.id === selectedProject.value)
                          ?.name
                      : "Select a project"}
                  </Text>
                  <Select.TriggerIndicator />
                </Select.Trigger>
                <Select.Portal hostName="calendar-settings">
                  <Select.Overlay />
                  <Select.Content presentation="popover" width="trigger">
                    <Select.ListLabel>Select a project</Select.ListLabel>
                    {projects.map((p) => (
                      <Select.Item
                        key={p.id}
                        value={p.id}
                        label={p.name}
                        onValueChange={(v) =>
                          setSelectedProject({
                            value: v,
                            label:
                              projects.find((proj) => proj.id === v)?.name ||
                              "",
                          })
                        }
                      >
                        <View className="flex-row items-center gap-3 flex-1">
                          <Image
                            source={`sf:${p.icon}`}
                            style={{
                              width: 18,
                              height: 18,
                              tintColor: p.color,
                            }}
                          />
                          <Select.ItemLabel />
                        </View>
                        <Select.ItemIndicator />
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Portal>
              </Select>
            </View>
          </ScrollView>

          <PortalHost name="calendar-settings" />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 18,
    height: 18,
  },
});
