"use client";

import { matchJobToProfile, type Job } from "@jobccq/shared";
import { Badge } from "./Badge";
import { useProfile } from "@/lib/profile";

/** Badge « N % pour toi » — uniquement si un profil métier est renseigné. */
export function MatchBadge({ job }: { job: Job }) {
  const profile = useProfile();
  const m = matchJobToProfile(job, profile);
  if (!m) return null;
  const tone = m.score >= 70 ? "green" : m.score >= 40 ? "amber" : "slate";
  const title = m.reasons.length ? m.reasons.join(" · ") : "Peu d'axes du profil collent";
  return (
    <Badge tone={tone} className="tabular-nums" title={title}>
      {m.score} % pour toi
    </Badge>
  );
}
