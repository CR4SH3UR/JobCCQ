/** Modules Expo optionnels — types minimaux pour le typecheck hors `npm install`. */
declare module "expo-notifications" {
  export const AndroidImportance: { DEFAULT: number };
  export function getPermissionsAsync(): Promise<{ status: string }>;
  export function requestPermissionsAsync(): Promise<{ status: string }>;
  export function setNotificationChannelAsync(
    id: string,
    opts: { name: string; importance: number },
  ): Promise<void>;
  export function getExpoPushTokenAsync(): Promise<{ data: string }>;
}

declare module "expo-device" {
  export const isDevice: boolean;
}
