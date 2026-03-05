import { ProjectsProvider } from "@/contexts/projects-context";
import { TimerProvider } from "@/contexts/timer-context";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import "../global.css";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <KeyboardProvider>
          <ThemeProvider value={DarkTheme}>
            <ProjectsProvider>
              <TimerProvider>
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                </Stack>
              </TimerProvider>
            </ProjectsProvider>
            <StatusBar style="light" />
          </ThemeProvider>
        </KeyboardProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
