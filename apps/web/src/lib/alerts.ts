"use client";

import { useCallback, useEffect, useState } from "react";
import type { JobQuery } from "@jobccq/shared";
import { supabase } from "./supabase";

/**
 * Alertes emploi (recherches sauvegardées) synchronisées dans Supabase. Un
 * utilisateur connecté enregistre les critères de sa recherche ; le CI envoie un
 * courriel quand de nouvelles offres y correspondent (voir apps/api/src/notify.ts).
 */
export type JobAlert = { id: string; label: string | null; query: Partial<JobQuery>; created_at: string };

/** Ne conserve que les critères de filtrage (pas la pagination ni le tri). */
export function filterQuery(q: JobQuery): Partial<JobQuery> {
  const out: Record<string, unknown> = {};
  if (q.q) out.q = q.q;
  if (q.cities?.length) out.cities = q.cities;
  if (q.regions?.length) out.regions = q.regions;
  if (q.categories?.length) out.categories = q.categories;
  if (q.employmentTypes?.length) out.employmentTypes = q.employmentTypes;
  if (q.remote?.length) out.remote = q.remote;
  if (q.sources?.length) out.sources = q.sources;
  if (q.languages?.length) out.languages = q.languages;
  if (q.salaryMin != null) out.salaryMin = q.salaryMin;
  if (q.salaryListed) out.salaryListed = true;
  if (q.postedWithinDays != null) out.postedWithinDays = q.postedWithinDays;
  if (q.postedSince) out.postedSince = q.postedSince;
  if (q.trades?.length) out.trades = q.trades;
  if (q.shifts?.length) out.shifts = q.shifts;
  if (q.near) out.near = q.near;
  if (q.radiusKm != null) out.radiusKm = q.radiusKm;
  return out as Partial<JobQuery>;
}

export function useAlerts(): { alerts: JobAlert[]; loading: boolean; refresh: () => Promise<void> } {
  const [alerts, setAlerts] = useState<JobAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("job_alerts")
      .select("id,label,query,created_at")
      .order("created_at", { ascending: false });
    setAlerts((data ?? []) as JobAlert[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { alerts, loading, refresh };
}

export async function createAlert(label: string, query: Partial<JobQuery>): Promise<{ error?: string }> {
  if (!supabase) return { error: "Comptes non configurés." };
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: "Connecte-toi d'abord." };
  const { error } = await supabase.from("job_alerts").insert({ user_id: u.user.id, label, query });
  return error ? { error: error.message } : {};
}

export async function deleteAlert(id: string): Promise<void> {
  await supabase?.from("job_alerts").delete().eq("id", id);
}
