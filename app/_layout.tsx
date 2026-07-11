import { ChronaSplash } from "@/components/chrona-splash";
import { hasCompletedOnboarding } from "@/features/onboarding/onboarding-storage";
import { useWatchIntegration } from "@/features/watch/use-watch-integration";
import { useWidgetSync } from "@/features/watch/use-widget-sync";
import { useBackgroundServices } from "@/hooks/use-background-services";
import { Pacifico_400Regular } from "@expo-google-fonts/pacifico";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import "../global.css";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Pacifico_400Regular });

  useWidgetSync();
  useWatchIntegration();
  useBackgroundServices();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
      if (!hasCompletedOnboarding()) {
        router.replace("/onboarding");
      }
    }
  }, [fontsLoaded, fontError]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider
        config={{ toast: { defaultProps: { placement: "top" } } }}
      >
        <KeyboardProvider>
          <ThemeProvider value={DarkTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="stop" options={{ headerShown: false }} />
              <Stack.Screen
                name="timer"
                options={{ presentation: "modal", headerShown: false }}
              />
              <Stack.Screen
                name="calendar-settings"
                options={{ presentation: "modal", headerShown: false }}
              />
              <Stack.Screen
                name="projects"
                options={{ presentation: "modal", headerShown: false }}
              />
              <Stack.Screen
                name="timer-style"
                options={{ presentation: "modal", headerShown: false }}
              />
              <Stack.Screen
                name="onboarding"
                options={{ headerShown: false, gestureEnabled: false }}
              />
              <Stack.Screen
                name="settings"
                options={{
                  title: "Settings",
                  headerTransparent: true,
                  headerTitleStyle: {
                    color: "white",
                    fontSize: 17,
                    fontWeight: "600",
                  },
                }}
              />
            </Stack>
            <StatusBar style="light" />
          </ThemeProvider>
        </KeyboardProvider>
      </HeroUINativeProvider>
      <ChronaSplash />
    </GestureHandlerRootView>
  );
}
