"use client";

import type { Job } from "@jobccq/shared";
import { recordApplyClick } from "@/lib/apply-clicks";

/** Lien « Postuler » qui enregistre le clic (local + Supabase) avant d'ouvrir l'offre. */
export function ApplyLink({
  job,
  className,
  children,
}: {
  job: Pick<Job, "id" | "sourceId" | "title" | "url">;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => recordApplyClick(job)}
    >
      {children}
    </a>
  );
}
