"use client";

/**
 * Réclamations de fiche employeur (idée 87). Miroir local + table
 * `employer_claims`. Table absente → le miroir local suffit pour tester.
 */
import { useSyncExternalStore } from "react";
import {
  parseClaimStatus,
  type ClaimStatus,
} from "@jobccq/shared";
import { supabase } from "./supabase";

export type EmployerClaim = {
  userId: string;
  employerId: string;
  status: ClaimStatus;
  note: string;
  email: string;
  createdAt: string;
};

const KEY = "jobccq:employer-claims";
const COLS = "user_id, employer_id, status, note, email, created_at";
const COLS_MIN = "user_id, employer_id, status, note, created_at";
const listeners = new Set<() => void>();
let cache: EmployerClaim[] | null = null;

function readLocal(): EmployerClaim[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as EmployerClaim[]).map(normalizeClaim) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function normalizeClaim(c: EmployerClaim): EmployerClaim {
  return { ...c, email: (c.email ?? "").trim() };
}

function persist(list: EmployerClaim[]): void {
  cache = list.map(normalizeClaim);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* quota */
  }
  listeners.forEach((l) => l());
}

export function subscribeEmployerClaims(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function localClaims(): EmployerClaim[] {
  return readLocal();
}

function rowToClaim(r: Record<string, unknown>): EmployerClaim | null {
  const employerId = String(r.employer_id ?? "").trim();
  const status = parseClaimStatus(r.status);
  if (!employerId || !status) return null;
  return {
    userId: String(r.user_id ?? ""),
    employerId,
    status,
    note: String(r.note ?? ""),
    email: String(r.email ?? "").trim(),
    createdAt: String(r.created_at ?? ""),
  };
}

async function selectClaims(eqUserId?: string) {
  if (!supabase) return { data: null, error: new Error("no supabase") };
  const q = supabase.from("employer_claims").select(COLS).order("created_at", { ascending: false }).limit(200);
  const scoped = eqUserId ? q.eq("user_id", eqUserId) : q;
  const first = await scoped;
  if (!first.error) return first;
  if (!/email|column|schema cache/i.test(first.error.message)) return first;
  const fallback = supabase
    .from("employer_claims")
    .select(COLS_MIN)
    .order("created_at", { ascending: false })
    .limit(200);
  return eqUserId ? fallback.eq("user_id", eqUserId) : fallback;
}

export async function fetchMyClaims(userId: string): Promise<EmployerClaim[]> {
  if (supabase) {
    const { data, error } = await selectClaims(userId);
    if (!error && data) {
      const remote = data.map((r) => rowToClaim(r as Record<string, unknown>)).filter(Boolean) as EmployerClaim[];
      persist(remote);
      return remote;
    }
  }
  return readLocal().filter((c) => !userId || c.userId === userId || c.userId === "local");
}

export async function fetchAllClaims(): Promise<EmployerClaim[]> {
  if (!supabase) return readLocal();
  const { data, error } = await selectClaims();
  if (error || !data) return readLocal();
  return data.map((r) => rowToClaim(r as Record<string, unknown>)).filter(Boolean) as EmployerClaim[];
}

/** Complète les courriels manquants via l'annuaire admin (id → email). */
export async function lookupUserEmails(userIds: string[]): Promise<Map<string, string>> {
  const wanted = new Set(userIds.filter((id) => id && id !== "local"));
  const map = new Map<string, string>();
  if (wanted.size === 0) return map;

  const take = (users: { id?: string; email?: string }[] | undefined) => {
    for (const u of users ?? []) {
      if (u.id && u.email && wanted.has(u.id)) map.set(u.id, u.email);
    }
  };

  try {
    const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
    const token = data.session?.access_token;
    if (token) {
      const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
      const res = await fetch(`${api}/admin/users?perPage=200`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const body = (await res.json()) as { users?: { id: string; email: string }[] };
        take(body.users);
      }
    }
  } catch {
    /* API locale absente */
  }

  if (map.size < wanted.size && supabase) {
    try {
      const { data } = await supabase.functions.invoke<{ users?: { id: string; email: string }[] }>(
        "admin-users",
        { method: "GET" },
      );
      take(data?.users);
    } catch {
      /* edge absente */
    }
  }
  return map;
}

export function withLookupEmails(claims: EmployerClaim[], emails: Map<string, string>): EmployerClaim[] {
  return claims.map((c) => ({ ...c, email: emails.get(c.userId) || c.email }));
}

export async function submitClaim(
  employerId: string,
  userId: string,
  note = "",
  email = "",
): Promise<EmployerClaim> {
  const claim: EmployerClaim = {
    userId: userId || "local",
    employerId,
    status: supabase && userId ? "pending" : "approved",
    note: note.trim().slice(0, 400),
    email: email.trim(),
    createdAt: new Date().toISOString(),
  };
  persist([...readLocal().filter((c) => !(c.employerId === employerId && c.userId === claim.userId)), claim]);
  if (supabase && userId) {
    const row: Record<string, unknown> = {
      user_id: userId,
      employer_id: employerId,
      status: claim.status,
      note: claim.note,
    };
    if (claim.email) row.email = claim.email;
    const { error } = await supabase.from("employer_claims").upsert(row, { onConflict: "user_id,employer_id" });
    if (error && claim.email && /email|column|schema cache/i.test(error.message)) {
      delete row.email;
      const retry = await supabase.from("employer_claims").upsert(row, { onConflict: "user_id,employer_id" });
      if (retry.error) throw new Error(retry.error.message);
    } else if (error) {
      throw new Error(error.message);
    }
  }
  return claim;
}

export async function setClaimStatus(
  userId: string,
  employerId: string,
  status: ClaimStatus,
): Promise<void> {
  persist(
    readLocal().map((c) => (c.userId === userId && c.employerId === employerId ? { ...c, status } : c)),
  );
  if (!supabase) return;
  const { error } = await supabase
    .from("employer_claims")
    .update({ status })
    .eq("user_id", userId)
    .eq("employer_id", employerId);
  if (error) throw new Error(error.message);
}

/** Retire l'accès d'une fiche approuvée. */
export async function revokeClaim(userId: string, employerId: string): Promise<void> {
  try {
    await setClaimStatus(userId, employerId, "revoked");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/check|status|invalid|revoked/i.test(msg)) {
      await setClaimStatus(userId, employerId, "rejected");
      return;
    }
    throw e;
  }
}

export function approvedEmployerIds(claims: EmployerClaim[]): string[] {
  return claims.filter((c) => c.status === "approved").map((c) => c.employerId);
}

export function useLocalClaims(): EmployerClaim[] {
  return useSyncExternalStore(subscribeEmployerClaims, localClaims, () => []);
}
