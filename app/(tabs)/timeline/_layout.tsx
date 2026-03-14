import { Stack } from "expo-router";

export default function TimelineLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "",
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          headerTransparent: true,
          presentation: "card",
        }}
      />
    </Stack>
  );
}
