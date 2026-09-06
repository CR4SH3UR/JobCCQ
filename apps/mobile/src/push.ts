import { Platform } from "react-native";

const ENABLED_KEY = "jobccq:push";
const TOKEN_KEY = "jobccq:push-token";

export function isPushConfigured(): boolean {
  return !!(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
}

function readFlag(): boolean {
  try {
    const g = globalThis as { localStorage?: { getItem: (k: string) => string | null } };
    return g.localStorage?.getItem(ENABLED_KEY) === "1";
  } catch {
    return memoryEnabled;
  }
}

let memoryEnabled = false;
let memoryToken: string | null = null;

function persistFlag(on: boolean): void {
  memoryEnabled = on;
  try {
    const g = globalThis as { localStorage?: { setItem: (k: string, v: string) => void } };
    g.localStorage?.setItem(ENABLED_KEY, on ? "1" : "0");
  } catch {
    /* native : mémoire seulement */
  }
}

function persistToken(token: string | null): void {
  memoryToken = token;
  try {
    const g = globalThis as { localStorage?: { setItem: (k: string, v: string) => void } };
    if (token) g.localStorage?.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

function readToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    const g = globalThis as { localStorage?: { getItem: (k: string) => string | null } };
    memoryToken = g.localStorage?.getItem(TOKEN_KEY) ?? null;
  } catch {
    /* ignore */
  }
  return memoryToken;
}

async function upsertToken(token: string, enabled: boolean): Promise<void> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  await fetch(`${url}/rest/v1/push_tokens`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      token,
      enabled,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    }),
  });
}

/**
 * Active les notifications Expo (permission + jeton). No-op sur le web /
 * simulateur. Le cron `notify` envoie ensuite les nouvelles offres via l'API Expo.
 */
export async function enablePush(): Promise<{ ok: boolean; message: string }> {
  if (Platform.OS === "web") {
    return { ok: false, message: "Les notifications push sont disponibles dans Expo Go (téléphone)." };
  }
  if (!isPushConfigured()) {
    return { ok: false, message: "Supabase n'est pas configuré (EXPO_PUBLIC_SUPABASE_*)." };
  }
  try {
    const Notifications = await import("expo-notifications");
    const Device = await import("expo-device");
    if (!Device.isDevice) {
      return { ok: false, message: "Les notifications demandent un téléphone physique." };
    }
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") {
      return { ok: false, message: "Permission refusée." };
    }
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Offres",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    persistToken(token);
    persistFlag(true);
    await upsertToken(token, true);
    return { ok: true, message: "Notifications activées." };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export async function disablePush(): Promise<void> {
  persistFlag(false);
  const token = readToken();
  if (token) await upsertToken(token, false);
}

export function pushEnabled(): boolean {
  return readFlag();
}
