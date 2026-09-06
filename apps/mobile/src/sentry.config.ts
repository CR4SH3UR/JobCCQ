import * as Sentry from "@sentry/react-native";

export function initSentry() {
  const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || "production",
    tracesSampleRate: 1.0,
    debug: process.env.NODE_ENV === "development",
  });
}
