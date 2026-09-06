"use client";

import { useEffect } from "react";
import { reportToSentry } from "@jobccq/shared";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

/** Active le suivi Sentry côté navigateur si le DSN est défini au build. */
export function SentryBoot() {
  useEffect(() => {
    if (!DSN) return;
    const onError = (e: ErrorEvent) => {
      void reportToSentry(DSN, e.error ?? e.message, { app: "web" });
    };
    const onReject = (e: PromiseRejectionEvent) => {
      void reportToSentry(DSN, e.reason, { app: "web" });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
    };
  }, []);
  return null;
}
