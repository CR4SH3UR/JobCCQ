import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { searchJobs } from "@/api";
import { JobCard } from "@/components/JobCard";
import { useFavoriteIds } from "@/favorites";
import { disablePush, enablePush, isPushConfigured, pushEnabled } from "@/push";
import { buildQuery, type Job } from "@/shared";
import { colors, fontSize, radius, spacing } from "@/theme";

export default function FavorisScreen() {
  const ids = useFavoriteIds();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushOn, setPushOn] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    setPushOn(pushEnabled());
  }, []);

  useEffect(() => {
    searchJobs(buildQuery({ pageSize: 100, sort: "recent" }))
      .then((r) => setJobs(r.items.filter((j) => ids.includes(j.id))))
      .finally(() => setLoading(false));
  }, [ids]);

  const togglePush = async () => {
    setPushBusy(true);
    setPushMsg(null);
    if (pushOn) {
      await disablePush();
      setPushOn(false);
      setPushMsg("Notifications désactivées.");
    } else {
      const r = await enablePush();
      setPushOn(r.ok);
      setPushMsg(r.message);
    }
    setPushBusy(false);
  };

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
      ListHeaderComponent={
        <View style={styles.pushBox}>
          <Text style={styles.pushTitle}>Nouvelles offres</Text>
          <Text style={styles.pushHint}>
            {isPushConfigured()
              ? "Un avis sur le téléphone quand le scrape trouve des postes qui matchent."
              : "Configure EXPO_PUBLIC_SUPABASE_URL / ANON_KEY pour activer le push."}
          </Text>
          <Pressable
            onPress={() => void togglePush()}
            disabled={pushBusy || !isPushConfigured()}
            style={[styles.pushBtn, pushOn && styles.pushBtnOn, (pushBusy || !isPushConfigured()) && styles.pushBtnOff]}
          >
            <Text style={styles.pushBtnText}>
              {pushBusy ? "…" : pushOn ? "Désactiver les notifications" : "Activer les notifications"}
            </Text>
          </Pressable>
          {pushMsg ? <Text style={styles.pushMsg}>{pushMsg}</Text> : null}
        </View>
      }
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
  pushBox: {
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 6,
  },
  pushTitle: { fontWeight: "700", color: colors.slate900, fontSize: fontSize.md },
  pushHint: { color: colors.slate600, fontSize: fontSize.sm },
  pushBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.brand600,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  pushBtnOn: { backgroundColor: colors.slate600 },
  pushBtnOff: { opacity: 0.5 },
  pushBtnText: { color: colors.white, fontWeight: "600", fontSize: fontSize.sm },
  pushMsg: { color: colors.slate600, fontSize: fontSize.sm },
});
