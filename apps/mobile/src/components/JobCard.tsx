/**
 * Carte d'offre d'emploi (écran Emplois).
 * Toucher la carte ouvre l'offre originale (job.url) dans le navigateur.
 */
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Badge, type BadgeTone } from "./Badge";
import { colors, fontSize, radius, spacing } from "@/theme";
import { formatSalary, initials, timeAgo } from "@/format";
import {
  labelForCategory,
  labelForEmployment,
  labelForRegion,
  labelForRemote,
  sourceName,
  type Job,
} from "@/shared";

const REMOTE_TONE: Record<NonNullable<Job["remote"]>, BadgeTone> = {
  teletravail: "green",
  hybride: "violet",
  presentiel: "slate",
};

const AVATAR_SIZE = 44;

export function JobCard({ job }: { job: Job }) {
  const salary = formatSalary(job);
  const region = labelForRegion(job.regionId);
  const posted = timeAgo(job.postedAt ?? job.scrapedAt);
  const locationLabel = job.city ?? region;

  const openJob = () => {
    Linking.openURL(job.url).catch(() => {
      // Échec silencieux (URL invalide ou aucune app disponible) : on ne bloque pas l'utilisateur.
    });
  };

  return (
    <Pressable
      onPress={openJob}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="link"
      accessibilityLabel={`${job.title} chez ${job.company}. Ouvrir l'offre.`}
    >
      <View style={styles.row}>
        <Avatar name={job.company} logoUrl={job.companyLogoUrl} />

        <View style={styles.flex1}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {job.title}
            </Text>
            {posted && <Text style={styles.posted}>{posted}</Text>}
          </View>

          <Text style={styles.subline} numberOfLines={1}>
            <Text style={styles.companyName}>{job.company}</Text>
            {locationLabel ? <Text style={styles.location}> · {locationLabel}</Text> : null}
          </Text>

          <View style={styles.badges}>
            {job.categoryId && <Badge tone="brand">{labelForCategory(job.categoryId)!}</Badge>}
            {job.employmentType && <Badge>{labelForEmployment(job.employmentType)!}</Badge>}
            {job.remote && (
              <Badge tone={REMOTE_TONE[job.remote]}>{labelForRemote(job.remote)!}</Badge>
            )}
            {salary && <Badge tone="green">{salary}</Badge>}
          </View>

          {job.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {job.description}
            </Text>
          ) : null}

          <Text style={styles.via}>via {sourceName(job.sourceId)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function Avatar({ name, logoUrl }: { name: string; logoUrl?: string }) {
  if (logoUrl) {
    return <Image source={{ uri: logoUrl }} style={styles.avatarImg} resizeMode="contain" />;
  }
  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarInitials}>{initials(name)}</Text>
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
  cardPressed: {
    backgroundColor: colors.slate50,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  flex1: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.slate900,
  },
  posted: {
    fontSize: fontSize.xs,
    color: colors.slate400,
    marginTop: 2,
  },
  subline: {
    marginTop: 2,
    fontSize: fontSize.sm,
  },
  companyName: {
    fontWeight: "600",
    color: colors.slate800,
  },
  location: {
    color: colors.slate500,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
  },
  description: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.slate500,
    lineHeight: 19,
  },
  via: {
    marginTop: spacing.md,
    fontSize: fontSize.xs,
    color: colors.slate400,
  },
  avatarImg: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
  },
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radius.md,
    backgroundColor: colors.brand50,
    borderWidth: 1,
    borderColor: colors.brand100,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.brand700,
  },
});
