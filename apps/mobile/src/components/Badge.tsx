/**
 * Petite étiquette colorée (catégorie, statut, région...).
 * Équivalent RN de apps/web/src/components/Badge.tsx.
 */
import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, fontSize, radius, spacing } from "@/theme";

export type BadgeTone = "slate" | "brand" | "green" | "amber" | "violet";

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  slate: { bg: colors.slate100, fg: colors.slate700 },
  brand: { bg: colors.brand50, fg: colors.brand700 },
  green: { bg: colors.green50, fg: colors.green700 },
  amber: { bg: colors.amber50, fg: colors.amber700 },
  violet: { bg: colors.violet50, fg: colors.violet700 },
};

export function Badge({
  children,
  tone = "slate",
  style,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
}) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]}>
      <Text style={[styles.text, { color: t.fg }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
});
