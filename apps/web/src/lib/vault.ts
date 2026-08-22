"use client";

import { supabase } from "./supabase";

/**
 * Coffre-fort chiffré des identifiants admin (jeton GitHub + URL/jeton Turso).
 *
 * Les secrets sont chiffrés **dans le navigateur** (AES-GCM 256, clé dérivée
 * d'une phrase secrète via PBKDF2) AVANT d'être stockés dans la table Supabase
 * `admin_secrets` (une ligne par compte, protégée par RLS). Conséquence : même
 * une fuite de la base ne révèle rien sans la phrase secrète, qui n'est jamais
 * transmise ni stockée. La phrase se saisit une fois par appareil.
 */

const dec = new TextDecoder();

/** Encode une chaîne en octets adossés à un ArrayBuffer (compatible BufferSource). */
function bytes(s: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new TextEncoder().encode(s));
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", bytes(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 150_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function toB64(b: Uint8Array): string {
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s);
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}

/** Chiffre un objet en une chaîne `v1.<sel>.<iv>.<chiffré>` (base64). */
export async function encryptJson(obj: unknown, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes(JSON.stringify(obj))),
  );
  return `v1.${toB64(salt)}.${toB64(iv)}.${toB64(ct)}`;
}

/** Déchiffre une chaîne produite par `encryptJson`. Lève si la phrase est fausse. */
export async function decryptJson<T>(blob: string, passphrase: string): Promise<T> {
  const [ver, s, i, c] = blob.split(".");
  if (ver !== "v1" || !s || !i || !c) throw new Error("Format de coffre inconnu.");
  const key = await deriveKey(passphrase, fromB64(s));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(i) }, key, fromB64(c));
  return JSON.parse(dec.decode(pt)) as T;
}

/** Secrets admin stockés dans le coffre. */
export interface AdminSecrets {
  ghToken?: string;
  tursoUrl?: string;
  tursoToken?: string;
}

/** Enregistre le blob chiffré dans le compte (upsert sur user_id). */
export async function saveVault(userId: string, ciphertext: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Comptes non configurés." };
  const { error } = await supabase
    .from("admin_secrets")
    .upsert({ user_id: userId, ciphertext, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  return error ? { error: error.message } : {};
}

/** Lit le blob chiffré du compte (undefined si aucun). */
export async function loadVault(userId: string): Promise<{ ciphertext?: string; error?: string }> {
  if (!supabase) return { error: "Comptes non configurés." };
  const { data, error } = await supabase
    .from("admin_secrets")
    .select("ciphertext")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { error: error.message };
  return { ciphertext: (data as { ciphertext?: string } | null)?.ciphertext };
}

/** Supprime le coffre du compte. */
export async function clearVault(userId: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Comptes non configurés." };
  const { error } = await supabase.from("admin_secrets").delete().eq("user_id", userId);
  return error ? { error: error.message } : {};
}
