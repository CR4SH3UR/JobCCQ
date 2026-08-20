/**
 * Carte source (écran Sources) : nom, portée, badges région/méthode/statut/volume.
 * Toucher l'adresse ouvre le site de la source.
 */
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Badge, type BadgeTone } from "./Badge";
import { colors, fontSize, radius, spacing } from "@/theme";
import type { SourceStatus, SourceWithMeta } from "@/shared";

const STATUS: Record<SourceStatus, { label: string; tone: BadgeTone }> = {
  active: { label: "Actif", tone: "green" },
  experimental: { label: "Expérimental", tone: "amber" },
  planned: { label: "Répertorié", tone: "slate" },
};

const REGION_LABEL: Record<string, string> = { QC: "Québec", CA: "Canada", INTL: "International" };
const METHOD_LABEL: Record<string, string> = {
  html: "HTML",
  headless: "Navigateur",
  api: "API",
  rss: "Flux RSS",
};

export function SourceCard({ source }: { source: SourceWithMeta }) {
  const status = STATUS[source.status];

  const openHomepage = () => {
    Linking.openURL(source.homepage).catch(() => {
      // Échec silencieux : URL de secours indisponible.
    });
  };

  return (
    <View style={[styles.card, source.featured && styles.cardFeatured]}>
      <View style={styles.header}>
        <View style={styles.flex1}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{source.name}</Text>
            {source.featured && <Badge tone="brand">Principale</Badge>}
          </View>
          <Pressable onPress={openHomepage} hitSlop={6}>
            <Text style={styles.homepage} numberOfLines={1}>
              {source.homepage.replace(/^https?:\/\//, "")}
            </Text>
          </Pressable>
        </View>
        <Badge tone={status.tone}>{status.label}</Badge>
      </View>

      <Text style={styles.scope}>{source.scope}</Text>

      <View style={styles.badgeRow}>
        <Badge>{REGION_LABEL[source.region] ?? source.region}</Badge>
        <Badge>{METHOD_LABEL[source.method] ?? source.method}</Badge>
        {source.hasScraper && <Badge tone="green">Scraper prêt</Badge>}
        {source.jobCount > 0 && <Badge tone="brand">{source.jobCount} offres</Badge>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    padding: spacing.lg,
  },
  cardFeatured: {
    borderColor: colors.brand200,
    borderWidth: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  flex1: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    flexWrap: "wrap",
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.slate900,
  },
  homepage: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.slate400,
  },
  scope: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.slate600,
    lineHeight: 19,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
    marginTop: spacing.md,
  },
});
