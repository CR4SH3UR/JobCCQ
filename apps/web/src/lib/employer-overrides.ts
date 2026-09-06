/**
 * Overlay fiche employeur (logo + description) — table `employer_overrides`.
 */
import { parseEmployerPatch, type EmployerPatch } from "@jobccq/shared";
import { supabase } from "./supabase";

const KEY = "jobccq:employer-overrides";

export async function fetchEmployerOverrides(): Promise<Map<string, EmployerPatch>> {
  const map = new Map<string, EmployerPatch>();
  try {
    if (typeof window === "undefined") {
      /* SSR : on lira Supabase seulement */
    } else {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const obj = JSON.parse(raw) as Record<string, EmployerPatch>;
        for (const [id, p] of Object.entries(obj)) map.set(id, parseEmployerPatch(p));
      }
    }
  } catch {
    /* ignore */
  }
  if (!supabase) return map;
  const { data, error } = await supabase.from("employer_overrides").select("employer_id, patch");
  if (error || !data) return map;
  for (const r of data as { employer_id: string; patch: unknown }[]) {
    if (r.employer_id) map.set(r.employer_id, parseEmployerPatch(r.patch));
  }
  return map;
}

export async function upsertEmployerOverride(employerId: string, patch: EmployerPatch): Promise<void> {
  const clean = parseEmployerPatch(patch);
  try {
    const raw = localStorage.getItem(KEY);
    const obj = raw ? (JSON.parse(raw) as Record<string, EmployerPatch>) : {};
    obj[employerId] = clean;
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch {
    /* quota */
  }
  if (!supabase) return;
  const { error } = await supabase.from("employer_overrides").upsert(
    { employer_id: employerId, patch: clean, updated_at: new Date().toISOString() },
    { onConflict: "employer_id" },
  );
  if (error) throw new Error(error.message);
}
