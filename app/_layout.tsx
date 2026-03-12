import { HeroOverlay } from "@/components/hero-overlay";
import { heroProgress } from "@/lib/hero-animation";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { withSpring } from "react-native-reanimated";
import "../global.css";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().then(() => {
      requestAnimationFrame(() => {
        heroProgress.value = withSpring(1, {
          mass: 1.2,
          damping: 22,
          stiffness: 180,
        });
      });
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <KeyboardProvider>
          <ThemeProvider value={DarkTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="timer"
                options={{ presentation: "modal", headerShown: false }}
              />
              <Stack.Screen
                name="recover"
                options={{ presentation: "modal", headerShown: false }}
              />
              <Stack.Screen
                name="calendar-settings"
                options={{ presentation: "modal", headerShown: false }}
              />
            </Stack>
            <StatusBar style="light" />
            <HeroOverlay />
          </ThemeProvider>
        </KeyboardProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
