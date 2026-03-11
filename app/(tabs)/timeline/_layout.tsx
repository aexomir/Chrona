import { Stack } from "expo-router";

export default function TimelineLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "",
          headerStyle: { backgroundColor: "#000000" },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          headerStyle: { backgroundColor: "#000000" },
          headerShadowVisible: false,
          headerBackTitle: "Timeline",
          headerTitle: "Session",
          presentation: "card",
        }}
      />
    </Stack>
  );
}
