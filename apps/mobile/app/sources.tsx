/**
 * Écran « Sources » : répertoire des sites d'emploi surveillés, regroupés
 * en « connectées » (actif/expérimental) et « répertoriées » (planifié),
 * avec badges région / méthode / statut / nb d'offres.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { getSources } from "@/api";
import { SourceCard } from "@/components/SourceCard";
import type { SourceWithMeta } from "@/shared";
import { colors, common, fontSize, spacing } from "@/theme";

interface Section {
  title: string;
  data: SourceWithMeta[];
}

export default function SourcesScreen() {
  const [sources, setSources] = useState<SourceWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: "load" | "refresh") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await getSources();
      setSources(result.sources);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau inconnue");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load("load");
  }, [load]);

  const onRefresh = useCallback(() => load("refresh"), [load]);

  // « Connectées » = source déjà branchée ou en test (miroir de apps/web/src/components/SourcesView.tsx).
  const sections = useMemo<Section[]>(() => {
    const connected = sources.filter((s) => s.status !== "planned");
    const planned = sources.filter((s) => s.status === "planned");
    const out: Section[] = [];
    if (connected.length > 0) out.push({ title: "Sources connectées", data: connected });
    if (planned.length > 0) out.push({ title: "Sites répertoriés (à connecter)", data: planned });
    return out;
  }, [sources]);

  const showFullError = !!error && sources.length === 0;
  const showFullLoading = loading && !error && sources.length === 0;

  if (showFullError) {
    return (
      <View style={common.screen}>
        <View style={common.center}>
          <View style={common.errorBox}>
            <Text style={common.errorText}>Impossible de charger les sources : {error}</Text>
          </View>
        </View>
      </View>
    );
  }

  if (showFullLoading) {
    return (
      <View style={common.screen}>
        <View style={common.center}>
          <ActivityIndicator color={colors.brand600} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={common.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SourceCard source={item} />}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{(section as Section).title}</Text>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        SectionSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand600}
            colors={[colors.brand600]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Aucune source répertoriée pour le moment.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: colors.slate500,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.slate500,
    textAlign: "center",
  },
});
