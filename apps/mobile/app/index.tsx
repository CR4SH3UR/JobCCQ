/**
 * Écran « Emplois » : recherche + filtre par catégorie + tri + liste infinie.
 *
 * - Barre de recherche (q) débouncée.
 * - Puces de catégories (filtre multi) défilables horizontalement.
 * - Sélecteur de tri (modale).
 * - FlatList avec défilement infini (pageSize = 20) et pull-to-refresh.
 * - États chargement / erreur / vide bien distincts.
 * - Toucher une offre ouvre job.url (géré par JobCard via Linking.openURL).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { searchJobs } from "@/api";
import { JobCard } from "@/components/JobCard";
import { useDebouncedValue } from "@/hooks";
import { JOB_CATEGORIES, SORT_OPTIONS, buildQuery, type Job, type SortOption } from "@/shared";
import { colors, common, fontSize, radius, spacing } from "@/theme";

const PAGE_SIZE = 20;

const SORT_LABELS: Record<SortOption, string> = {
  recent: "Plus récentes",
  relevance: "Pertinence",
  salary_desc: "Salaire (élevé → bas)",
  salary_asc: "Salaire (bas → élevé)",
  company: "Entreprise (A → Z)",
  distance: "Distance",
};

type FetchMode = "replace" | "append" | "refresh";

export default function EmploisScreen() {
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 350);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>("recent");
  const [sortModalOpen, setSortModalOpen] = useState(false);

  const [items, setItems] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ignore les réponses de requêtes obsolètes (filtre changé pendant un fetch en vol).
  const requestIdRef = useRef(0);

  const fetchPage = useCallback(
    async (pageToLoad: number, mode: FetchMode) => {
      const requestId = ++requestIdRef.current;
      if (mode === "replace") setLoading(true);
      if (mode === "append") setLoadingMore(true);
      if (mode === "refresh") setRefreshing(true);
      setError(null);

      try {
        const query = buildQuery({
          q: dq || undefined,
          categories: selectedCategories.length ? selectedCategories : undefined,
          sort,
          page: pageToLoad,
          pageSize: PAGE_SIZE,
        });
        const result = await searchJobs(query);
        if (requestId !== requestIdRef.current) return; // une requête plus récente a pris le relais

        setItems((prev) => (mode === "append" ? [...prev, ...result.items] : result.items));
        setTotal(result.total);
        setPage(result.page);
        setTotalPages(result.totalPages);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : "Erreur réseau inconnue");
      } finally {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [dq, selectedCategories, sort],
  );

  // Relance une recherche depuis la page 1 à chaque changement de filtre/tri.
  useEffect(() => {
    fetchPage(1, "replace");
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    // Une erreur précédente n'empêche pas de réessayer : fetchPage la réinitialise à chaque appel.
    if (loading || loadingMore || refreshing) return;
    if (page >= totalPages) return;
    fetchPage(page + 1, "append");
  }, [loading, loadingMore, refreshing, page, totalPages, fetchPage]);

  const onRefresh = useCallback(() => fetchPage(1, "refresh"), [fetchPage]);

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const resultLabel = useMemo(() => {
    if (loading && items.length === 0) return "Chargement…";
    return `${total} offre${total > 1 ? "s" : ""}`;
  }, [loading, items.length, total]);

  const showFullError = !!error && items.length === 0;
  const showFullLoading = loading && !error && items.length === 0;

  return (
    <View style={common.screen}>
      {/* Barre de recherche + puces de catégories + tri/compteur */}
      <View style={styles.filtersBlock}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Poste, mot-clé, entreprise…"
          placeholderTextColor={colors.slate400}
          style={common.input}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {JOB_CATEGORIES.map((cat) => {
            const active = selectedCategories.includes(cat.id);
            return (
              <Pressable
                key={cat.id}
                onPress={() => toggleCategory(cat.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.metaRow}>
          <Text style={styles.count}>{resultLabel}</Text>
          <Pressable
            style={styles.sortButton}
            onPress={() => setSortModalOpen(true)}
            accessibilityRole="button"
          >
            <Text style={styles.sortButtonText}>Trier : {SORT_LABELS[sort]} ▾</Text>
          </Pressable>
        </View>
      </View>

      {/* Contenu : erreur pleine page / chargement initial / liste */}
      {showFullError ? (
        <View style={common.center}>
          <View style={common.errorBox}>
            <Text style={common.errorText}>Impossible de charger les offres : {error}</Text>
          </View>
        </View>
      ) : showFullLoading ? (
        <View style={common.center}>
          <ActivityIndicator color={colors.brand600} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(job) => job.id}
          renderItem={({ item }) => <JobCard job={item} />}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
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
              <Text style={styles.emptyText}>Aucune offre ne correspond à ces critères.</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.brand600} />
              </View>
            ) : error && items.length > 0 ? (
              <View style={styles.footer}>
                <Text style={styles.footerError}>
                  Erreur lors du chargement de la suite : {error}
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Sélecteur de tri */}
      <Modal
        visible={sortModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSortModalOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Trier par</Text>
            {SORT_OPTIONS.map((opt) => {
              const active = opt === sort;
              return (
                <Pressable
                  key={opt}
                  style={styles.modalRow}
                  onPress={() => {
                    setSort(opt);
                    setSortModalOpen(false);
                  }}
                >
                  <Text style={[styles.modalRowText, active && styles.modalRowTextActive]}>
                    {SORT_LABELS[opt]}
                  </Text>
                  {active && <Text style={styles.modalCheck}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  filtersBlock: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  chipsRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.white,
  },
  chipActive: {
    backgroundColor: colors.brand600,
    borderColor: colors.brand600,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.slate600,
  },
  chipTextActive: {
    color: colors.white,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  count: {
    fontSize: fontSize.sm,
    color: colors.slate600,
  },
  sortButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  sortButtonText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.brand600,
  },
  listContent: {
    padding: spacing.lg,
    flexGrow: 1,
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
  footer: {
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  footerError: {
    fontSize: fontSize.xs,
    color: colors.red700,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: colors.slate400,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  modalRowText: {
    fontSize: fontSize.base,
    color: colors.slate700,
  },
  modalRowTextActive: {
    color: colors.brand600,
    fontWeight: "700",
  },
  modalCheck: {
    color: colors.brand600,
    fontWeight: "700",
  },
});
