import { Stack } from "expo-router";

export default function TimelineLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "",
          headerStyle: { backgroundColor: "#0a0f1e" },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          headerStyle: { backgroundColor: "#0a0f1e" },
          headerShadowVisible: false,
          headerBackTitle: "Timeline",
          headerTitle: "Session",
          presentation: "card",
        }}
      />
    </Stack>
  );
}
