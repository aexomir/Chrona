import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ListGroup, Separator } from "heroui-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useCalendarStore } from "@/stores/calendar-store";
import { calendarStatusLabel } from "@/lib/calendar";

function IconSquare({ icon, color }: { icon: string; color: string }) {
  return (
    <View style={[styles.iconSquare, { backgroundColor: color }]}>
      <Image source={`sf:${icon}`} style={styles.iconImg} tintColor="#fff" />
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs text-neutral-500 uppercase tracking-widest mb-2 ml-1">
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

function QuestionSuffix() {
  return <Text className="text-neutral-500 text-base">?</Text>;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { permissionStatus, isEnabled } = useCalendarStore();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-[#111113]"
      contentContainerClassName="px-5 pb-10"
    >
      <Text className="text-white text-4xl font-bold mt-8 mb-8">Settings</Text>

      {/* GENERAL */}
      <SectionLabel>General</SectionLabel>
      <ListGroup className="mb-8">
        <ListGroup.Item onPress={() => {}}>
          <ListGroup.ItemPrefix>
            <IconSquare icon="sun.min.fill" color="#f97316" />
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>Appearance</ListGroup.ItemTitle>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix>
            <ValueSuffix value="System" />
          </ListGroup.ItemSuffix>
        </ListGroup.Item>

        <Separator className="mx-4" />

        <ListGroup.Item onPress={() => {}}>
          <ListGroup.ItemPrefix>
            <IconSquare icon="bell.fill" color="#ef4444" />
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>Notifications</ListGroup.ItemTitle>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix>
            <ChevronSuffix />
          </ListGroup.ItemSuffix>
        </ListGroup.Item>

        <Separator className="mx-4" />

        <ListGroup.Item onPress={() => {}}>
          <ListGroup.ItemPrefix>
            <IconSquare icon="calendar" color="#22c55e" />
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>Week Start</ListGroup.ItemTitle>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix>
            <ValueSuffix value="Monday" />
          </ListGroup.ItemSuffix>
        </ListGroup.Item>

        <Separator className="mx-4" />

        <ListGroup.Item onPress={() => {}}>
          <ListGroup.ItemPrefix>
            <IconSquare icon="clock.fill" color="#636366" />
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>Idle Detection</ListGroup.ItemTitle>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix>
            <ValueSuffix value="After 5 min" />
          </ListGroup.ItemSuffix>
        </ListGroup.Item>
      </ListGroup>

      {/* INTEGRATIONS */}
      <SectionLabel>Integrations</SectionLabel>
      <ListGroup className="mb-8">
        <ListGroup.Item onPress={() => router.push("/calendar-settings")}>
          <ListGroup.ItemPrefix>
            <IconSquare icon="calendar.badge.checkmark" color="#3b82f6" />
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>Calendar</ListGroup.ItemTitle>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix>
            <ValueSuffix value={calendarStatusLabel(permissionStatus, isEnabled)} />
          </ListGroup.ItemSuffix>
        </ListGroup.Item>
      </ListGroup>

      {/* DATA & PRIVACY */}
      <SectionLabel>Data &amp; Privacy</SectionLabel>
      <ListGroup className="mb-8">
        <ListGroup.Item onPress={() => {}}>
          <ListGroup.ItemPrefix>
            <IconSquare icon="iphone" color="#3b82f6" />
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>Connected Devices</ListGroup.ItemTitle>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix>
            <ChevronSuffix />
          </ListGroup.ItemSuffix>
        </ListGroup.Item>

        <Separator className="mx-4" />

        <ListGroup.Item onPress={() => router.push("/projects")}>
          <ListGroup.ItemPrefix>
            <IconSquare icon="folder.fill" color="#a855f7" />
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>Projects</ListGroup.ItemTitle>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix>
            <ChevronSuffix />
          </ListGroup.ItemSuffix>
        </ListGroup.Item>

        <Separator className="mx-4" />

        <ListGroup.Item onPress={() => {}}>
          <ListGroup.ItemPrefix>
            <IconSquare icon="arrow.down.to.line" color="#22c55e" />
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>Export Data</ListGroup.ItemTitle>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix>
            <ChevronSuffix />
          </ListGroup.ItemSuffix>
        </ListGroup.Item>
      </ListGroup>

      {/* ABOUT */}
      <SectionLabel>About</SectionLabel>
      <ListGroup>
        <ListGroup.Item onPress={() => {}}>
          <ListGroup.ItemPrefix>
            <IconSquare icon="shield.fill" color="#636366" />
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>Privacy Policy</ListGroup.ItemTitle>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix>
            <QuestionSuffix />
          </ListGroup.ItemSuffix>
        </ListGroup.Item>

        <Separator className="mx-4" />

        <ListGroup.Item onPress={() => {}}>
          <ListGroup.ItemPrefix>
            <IconSquare icon="star.fill" color="#f59e0b" />
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>Rate Focus</ListGroup.ItemTitle>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix>
            <QuestionSuffix />
          </ListGroup.ItemSuffix>
        </ListGroup.Item>

        <Separator className="mx-4" />

        <ListGroup.Item onPress={() => {}}>
          <ListGroup.ItemPrefix>
            <IconSquare icon="envelope.fill" color="#3b82f6" />
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>Contact Us</ListGroup.ItemTitle>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix>
            <QuestionSuffix />
          </ListGroup.ItemSuffix>
        </ListGroup.Item>
      </ListGroup>
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
  chevron: {
    width: 13,
    height: 13,
  },
});
