/**
 * Écran « Qui recrute » : recherche d'entreprise + liste des entreprises
 * qui recrutent (nom, nb de postes, régions/catégories principales).
 *
 * Note : /api/companies agrège TOUTES les offres correspondant au filtre
 * (voir apps/api/src/repository.ts#getHiringCompanies) — pas de pagination
 * nécessaire côté client, une seule requête par recherche suffit.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { searchCompanies } from "@/api";
import { CompanyCard } from "@/components/CompanyCard";
import { useDebouncedValue } from "@/hooks";
import { buildQuery, type HiringCompany } from "@/shared";
import { colors, common, fontSize, spacing } from "@/theme";

/** Grand pageSize : le back-end agrège sur tout le résultat filtré, pas de pagination. */
const ALL_COMPANIES_PAGE_SIZE = 100_000;

export default function EntreprisesScreen() {
  const [company, setCompany] = useState("");
  const dcompany = useDebouncedValue(company, 350);

  const [companies, setCompanies] = useState<HiringCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const load = useCallback(
    async (mode: "load" | "refresh") => {
      const requestId = ++requestIdRef.current;
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const query = buildQuery({
          company: dcompany || undefined,
          pageSize: ALL_COMPANIES_PAGE_SIZE,
        });
        const result = await searchCompanies(query);
        if (requestId !== requestIdRef.current) return;
        setCompanies(result.companies);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : "Erreur réseau inconnue");
      } finally {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dcompany],
  );

  useEffect(() => {
    load("load");
  }, [load]);

  const onRefresh = useCallback(() => load("refresh"), [load]);

  const showFullError = !!error && companies.length === 0;
  const showFullLoading = loading && !error && companies.length === 0;

  return (
    <View style={common.screen}>
      <View style={styles.searchBlock}>
        <TextInput
          value={company}
          onChangeText={setCompany}
          placeholder="Rechercher une entreprise…"
          placeholderTextColor={colors.slate400}
          style={common.input}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <Text style={styles.count}>
          {loading && companies.length === 0
            ? "Chargement…"
            : `${companies.length} entreprise${companies.length > 1 ? "s" : ""} qui recrutent`}
        </Text>
      </View>

      {showFullError ? (
        <View style={common.center}>
          <View style={common.errorBox}>
            <Text style={common.errorText}>Impossible de charger les entreprises : {error}</Text>
          </View>
        </View>
      ) : showFullLoading ? (
        <View style={common.center}>
          <ActivityIndicator color={colors.brand600} size="large" />
        </View>
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(c) => c.company}
          renderItem={({ item }) => <CompanyCard company={item} />}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
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
              <Text style={styles.emptyText}>Aucune entreprise ne correspond à cette recherche.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBlock: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  count: {
    fontSize: fontSize.sm,
    color: colors.slate600,
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
});
