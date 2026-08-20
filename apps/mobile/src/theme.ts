/**
 * Thème visuel partagé : couleurs, espacements, styles communs.
 * Bleu de marque #1f45eb — cohérent avec le site (apps/web/src/app/globals.css).
 */
import { StyleSheet } from "react-native";

export const colors = {
  // Bleu « Québec » (marque)
  brand50: "#eef4ff",
  brand100: "#d9e6ff",
  brand200: "#bcd3ff",
  brand300: "#8eb6ff",
  brand400: "#598cff",
  brand500: "#3563f6",
  brand600: "#1f45eb",
  brand700: "#1a34d8",
  brand800: "#1c2faf",
  brand900: "#1c2d8a",

  // Neutres
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1e293b",
  slate900: "#0f172a",

  // Tons d'accentuation (badges)
  green50: "#ecfdf5",
  green700: "#047857",
  amber50: "#fffbeb",
  amber700: "#b45309",
  violet50: "#f5f3ff",
  violet700: "#6d28d9",
  red50: "#fef2f2",
  red200: "#fecaca",
  red700: "#b91c1c",

  white: "#ffffff",
  black: "#000000",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
};

export const fontSize = {
  xs: 12,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 26,
};

/** Styles communs réutilisés dans plusieurs écrans/composants. */
export const common = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.slate50,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    padding: spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.base,
    color: colors.slate900,
    backgroundColor: colors.white,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },
  errorBox: {
    width: "100%",
    backgroundColor: colors.red50,
    borderWidth: 1,
    borderColor: colors.red200,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  errorText: {
    color: colors.red700,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
});
