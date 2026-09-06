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
  createdAt: string;
};

const KEY = "jobccq:employer-claims";
const listeners = new Set<() => void>();
let cache: EmployerClaim[] | null = null;

function readLocal(): EmployerClaim[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as EmployerClaim[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function persist(list: EmployerClaim[]): void {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
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
    createdAt: String(r.created_at ?? ""),
  };
}

export async function fetchMyClaims(userId: string): Promise<EmployerClaim[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("employer_claims")
      .select("user_id, employer_id, status, note, created_at")
      .eq("user_id", userId);
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
  const { data, error } = await supabase
    .from("employer_claims")
    .select("user_id, employer_id, status, note, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return readLocal();
  return data.map((r) => rowToClaim(r as Record<string, unknown>)).filter(Boolean) as EmployerClaim[];
}

export async function submitClaim(employerId: string, userId: string, note = ""): Promise<EmployerClaim> {
  const claim: EmployerClaim = {
    userId: userId || "local",
    employerId,
    status: supabase && userId ? "pending" : "approved",
    note: note.trim().slice(0, 400),
    createdAt: new Date().toISOString(),
  };
  persist([...readLocal().filter((c) => !(c.employerId === employerId && c.userId === claim.userId)), claim]);
  if (supabase && userId) {
    const { error } = await supabase.from("employer_claims").upsert(
      {
        user_id: userId,
        employer_id: employerId,
        status: claim.status,
        note: claim.note,
      },
      { onConflict: "user_id,employer_id" },
    );
    if (error) throw new Error(error.message);
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

export function approvedEmployerIds(claims: EmployerClaim[]): string[] {
  return claims.filter((c) => c.status === "approved").map((c) => c.employerId);
}

export function useLocalClaims(): EmployerClaim[] {
  return useSyncExternalStore(subscribeEmployerClaims, localClaims, () => []);
}
