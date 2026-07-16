import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    debug: __DEV__,
    environment: __DEV__ ? "development" : "production",
    release: `chrona@${Constants.expoConfig?.version ?? "unknown"}`,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    enableAutoSessionTracking: true,
  });
}

export function trackEvent(
  category: string,
  message: string,
  data?: Record<string, unknown>,
) {
  Sentry.addBreadcrumb({ category, message, data, level: "info" });
}
export function captureError(
  error: unknown,
  feature: string,
  extra?: Record<string, unknown>,
) {
  Sentry.captureException(error, { tags: { feature }, extra });
}
