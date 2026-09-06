import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getJobById } from "@/api";
import { Badge } from "@/components/Badge";
import { formatSalary, timeAgo } from "@/format";
import { toggleFavorite, useIsFavorite } from "@/favorites";
import { labelForCategory, labelForEmployment, labelForRegion, type Job } from "@/shared";
import { colors, fontSize, spacing } from "@/theme";

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fav = useIsFavorite(id ?? "");

  useEffect(() => {
    if (!id) return;
    getJobById(id)
      .then((r) => setJob(r.job))
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <View style={styles.pad}>
        <Text style={styles.muted}>{error}</Text>
      </View>
    );
  }
  if (!job) {
    return (
      <View style={styles.pad}>
        <ActivityIndicator color={colors.brand600} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.title}>{job.title}</Text>
      <Text style={styles.company}>{job.company}</Text>
      <Text style={styles.muted}>
        {[job.city, labelForRegion(job.regionId)].filter(Boolean).join(" · ")}
        {job.postedAt ? ` · ${timeAgo(job.postedAt)}` : ""}
      </Text>
      <View style={styles.badges}>
        {job.categoryId ? <Badge tone="brand">{labelForCategory(job.categoryId) ?? ""}</Badge> : null}
        {job.employmentType ? <Badge>{labelForEmployment(job.employmentType) ?? ""}</Badge> : null}
        {formatSalary(job) ? <Badge tone="green">{formatSalary(job)}</Badge> : null}
      </View>
      {job.description ? <Text style={styles.desc}>{job.description}</Text> : null}
      <Pressable style={styles.primary} onPress={() => Linking.openURL(job.url)}>
        <Text style={styles.primaryText}>Postuler</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => toggleFavorite(job.id)}>
        <Text style={styles.secondaryText}>{fav ? "Retirer des favoris" : "Ajouter aux favoris"}</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Retour</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: fontSize.xl, fontWeight: "700", color: colors.slate900 },
  company: { fontSize: fontSize.md, fontWeight: "600", color: colors.slate700 },
  muted: { color: colors.slate500, fontSize: fontSize.sm },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: spacing.sm },
  desc: { color: colors.slate600, fontSize: fontSize.sm, lineHeight: 20, marginTop: spacing.sm },
  primary: {
    backgroundColor: colors.brand600,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  primaryText: { color: colors.white, fontWeight: "700" },
  secondary: { borderWidth: 1, borderColor: colors.slate200, borderRadius: 10, padding: spacing.md, alignItems: "center" },
  secondaryText: { color: colors.slate800, fontWeight: "600" },
  back: { color: colors.brand600, fontWeight: "600", marginTop: spacing.md },
});
