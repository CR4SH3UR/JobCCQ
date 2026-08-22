"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase (auth + base des favoris synchronisés). La clé « anon » est
 * **publique** par conception : la sécurité vient des règles RLS côté Supabase
 * (chaque utilisateur ne voit que ses propres favoris). Voir infra/README-supabase.md.
 *
 * Si les variables ne sont pas définies (dev local, ou avant configuration), le
 * client est `null` et l'app retombe proprement sur les favoris locaux
 * (localStorage) — rien ne casse.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

/** Les comptes/synchro sont-ils activés ? (variables Supabase présentes) */
export const supabaseEnabled = !!supabase;
