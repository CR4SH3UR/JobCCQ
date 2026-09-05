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
  const track = () => recordApplyClick(job);
  return (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onPointerDown={(e) => {
        if (e.button === 0) track();
      }}
      onAuxClick={(e) => {
        if (e.button === 1) track();
      }}
    >
      {children}
    </a>
  );
}
