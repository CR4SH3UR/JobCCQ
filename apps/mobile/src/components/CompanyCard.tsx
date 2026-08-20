/**
 * Carte entreprise (écran Qui recrute) : nom, nb de postes ouverts,
 * régions/catégories principales.
 */
import { Image, StyleSheet, Text, View } from "react-native";
import { Badge } from "./Badge";
import { colors, fontSize, radius, spacing } from "@/theme";
import { initials, timeAgo } from "@/format";
import { labelForCategory, labelForRegion, type HiringCompany } from "@/shared";

const AVATAR_SIZE = 44;
const MAX_TAGS = 3;

export function CompanyCard({ company }: { company: HiringCompany }) {
  const latest = timeAgo(company.latestPostedAt);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {company.companyLogoUrl ? (
          <Image
            source={{ uri: company.companyLogoUrl }}
            style={styles.avatarImg}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitials}>{initials(company.company)}</Text>
          </View>
        )}
        <View style={styles.flex1}>
          <Text style={styles.name} numberOfLines={1}>
            {company.company}
          </Text>
          <Text style={styles.openings}>
            {company.openings} poste{company.openings > 1 ? "s" : ""} ouvert
            {company.openings > 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      {company.categories.length > 0 && (
        <View style={styles.badgeRow}>
          {company.categories.slice(0, MAX_TAGS).map((cat) => (
            <Badge key={cat} tone="brand">
              {labelForCategory(cat) ?? cat}
            </Badge>
          ))}
        </View>
      )}

      {company.regions.length > 0 && (
        <View style={styles.badgeRow}>
          {company.regions.slice(0, MAX_TAGS).map((r) => (
            <Badge key={r}>{labelForRegion(r) ?? r}</Badge>
          ))}
        </View>
      )}

      {latest && <Text style={styles.latest}>Dernière offre {latest}</Text>}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  flex1: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.slate900,
  },
  openings: {
    marginTop: 2,
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.brand700,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
  },
  latest: {
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
