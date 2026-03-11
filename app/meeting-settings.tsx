import { MEETING_APPS } from "@/lib/meetingDetection";
import { useMeetingStore } from "@/stores/meeting-store";
import { Image } from "expo-image";
import { ListGroup, Separator } from "heroui-native";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs text-neutral-500 uppercase tracking-widest mb-2 ml-1">
      {children}
    </Text>
  );
}

function IconSquare({ icon, color }: { icon: string; color: string }) {
  return (
    <View style={[styles.iconSquare, { backgroundColor: color }]}>
      <Image source={`sf:${icon}`} style={styles.iconImg} tintColor="#fff" />
    </View>
  );
}

export default function MeetingSettingsScreen() {
  const { isEnabled, selectedAppIds, setEnabled, toggleApp } =
    useMeetingStore();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-[#111113]"
      contentContainerClassName="px-5 pb-10"
    >
      <Text className="text-white text-4xl font-bold mt-8 mb-8">Meetings</Text>

      {/* INTEGRATION SECTION */}
      <SectionLabel>Integration</SectionLabel>
      <ListGroup className="mb-8">
        <ListGroup.Item>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>Enable Meeting Detection</ListGroup.ItemTitle>
            <Text className="text-zinc-400 text-xs mt-1">
              Automatically detect when you&apos;re in a meeting
            </Text>
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
      </ListGroup>

      {/* MEETING APPS SECTION */}
      {isEnabled && (
        <>
          <SectionLabel>Detect From</SectionLabel>
          <ListGroup className="mb-6">
            {MEETING_APPS.map((app, index) => {
              const isSelected = selectedAppIds.includes(app.id);
              const isOnlySelected =
                isSelected && selectedAppIds.length === 1;

              return (
                <View key={app.id}>
                  {index > 0 && <Separator className="mx-4" />}
                  <ListGroup.Item
                    onPress={() => {
                      // Allow disabling the last app (store will handle gracefully)
                      toggleApp(app.id);
                    }}
                  >
                    <ListGroup.ItemPrefix>
                      <IconSquare icon={app.icon} color="#7c3aed" />
                    </ListGroup.ItemPrefix>
                    <ListGroup.ItemContent>
                      <ListGroup.ItemTitle>{app.displayName}</ListGroup.ItemTitle>
                    </ListGroup.ItemContent>
                    <ListGroup.ItemSuffix>
                      <TouchableOpacity
                        onPress={() => {
                          // Allow disabling the last app
                          toggleApp(app.id);
                        }}
                        disabled={isOnlySelected}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            isSelected && styles.checkboxActive,
                            isOnlySelected && styles.checkboxDisabled,
                          ]}
                        >
                          {isSelected && (
                            <Image
                              source="sf:checkmark"
                              style={styles.checkmark}
                              tintColor="#fff"
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    </ListGroup.ItemSuffix>
                  </ListGroup.Item>
                </View>
              );
            })}
          </ListGroup>

          <Text className="text-xs text-neutral-500 mb-8">
            Detection uses window activity from ActivityWatch — no additional
            permissions required.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  iconSquare: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  iconImg: {
    width: 16,
    height: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#636366",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
  },
  checkboxDisabled: {
    opacity: 0.5,
  },
  checkmark: {
    width: 14,
    height: 14,
  },
});
