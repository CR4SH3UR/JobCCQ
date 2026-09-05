import { sourceName, type DuplicateAlt } from "@jobccq/shared";
import { Badge } from "./Badge";

/** Badge « aussi sur {portail} » pour un poste recensé ailleurs. */
export function AlsoOnBadge({ alts }: { alts?: DuplicateAlt[] }) {
  if (!alts?.length) return null;
  const names = [...new Set(alts.map((a) => sourceName(a.sourceId)))];
  const label =
    names.length === 1 ? `Aussi sur ${names[0]}` : `Aussi sur ${names.slice(0, 3).join(", ")}`;
  return (
    <Badge tone="slate" title="Même poste publié sur un autre portail">
      {label}
    </Badge>
  );
}
