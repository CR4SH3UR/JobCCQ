import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { searchJobs } from "@/api";
import { JobCard } from "@/components/JobCard";
import { useFavoriteIds } from "@/favorites";
import { buildQuery, type Job } from "@/shared";
import { colors, fontSize, spacing } from "@/theme";

export default function FavorisScreen() {
  const ids = useFavoriteIds();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    searchJobs(buildQuery({ pageSize: 100, sort: "recent" }))
      .then((r) => setJobs(r.items.filter((j) => ids.includes(j.id))))
      .finally(() => setLoading(false));
  }, [ids]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand600} />
      </View>
    );
  }

  return (
    <FlatList
      data={jobs}
      keyExtractor={(j) => j.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <Text style={styles.empty}>Aucun favori. Ouvre une offre et ajoute-la à tes favoris.</Text>
      }
      renderItem={({ item }) => <JobCard job={item} />}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center" },
  list: { padding: spacing.md, gap: spacing.sm },
  empty: { color: colors.slate500, fontSize: fontSize.sm, padding: spacing.lg },
});
