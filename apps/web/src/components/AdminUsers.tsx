"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/data";
import { isAdminEmail } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type AdminUserRow = {
  id: string;
  email: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  confirmedAt: string | null;
  providers: string[];
};

type UsersState = {
  loading: boolean;
  users: AdminUserRow[];
  total: number;
  error?: string;
};

type UsersResponse = {
  users?: AdminUserRow[];
  total?: number;
  error?: string;
};

type InviteResponse = {
  invited?: boolean;
  email?: string;
  error?: string;
};

type UserFilter = "all" | "admin" | "confirmed" | "unconfirmed" | "recent";
type UserSort = "newest" | "oldest" | "email" | "lastSignIn";

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function isRecent(value: string | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return date.getTime() >= thirtyDaysAgo;
}

function sortDate(value: string | null): number {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function AdminUsers() {
  const [state, setState] = useState<UsersState>({ loading: false, users: [], total: 0 });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [sort, setSort] = useState<UserSort>("newest");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState<string | undefined>();
  const [inviteError, setInviteError] = useState<string | undefined>();
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => {
    const adminCount = state.users.filter((user) => isAdminEmail(user.email)).length;
    const confirmedCount = state.users.filter((user) => !!user.confirmedAt).length;
    const recentCount = state.users.filter((user) => isRecent(user.lastSignInAt)).length;
    return {
      adminCount,
      confirmedCount,
      recentCount,
      unconfirmedCount: Math.max(0, state.users.length - confirmedCount),
    };
  }, [state.users]);

  const visibleUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.users
      .filter((user) => {
        const matchesQuery =
          !needle ||
          user.email.toLowerCase().includes(needle) ||
          user.id.toLowerCase().includes(needle) ||
          user.providers.some((provider) => provider.toLowerCase().includes(needle));
        if (!matchesQuery) return false;
        if (filter === "admin") return isAdminEmail(user.email);
        if (filter === "confirmed") return !!user.confirmedAt;
        if (filter === "unconfirmed") return !user.confirmedAt;
        if (filter === "recent") return isRecent(user.lastSignInAt);
        return true;
      })
      .sort((a, b) => {
        if (sort === "email") return a.email.localeCompare(b.email, "fr-CA");
        if (sort === "oldest") return sortDate(a.createdAt) - sortDate(b.createdAt);
        if (sort === "lastSignIn") return sortDate(b.lastSignInAt) - sortDate(a.lastSignInAt);
        return sortDate(b.createdAt) - sortDate(a.createdAt);
      });
  }, [filter, query, sort, state.users]);

  const loadFromApi = async (token: string): Promise<UsersResponse> => {
    const res = await fetch(`${API_URL}/admin/users?perPage=200`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json().catch(() => ({}))) as UsersResponse;
    if (!res.ok) throw new Error(body.error ?? `API admin HTTP ${res.status}`);
    return body;
  };

  const loadFromEdgeFunction = async (): Promise<UsersResponse> => {
    const { data, error } = await supabase!.functions.invoke<UsersResponse>("admin-users", {
      method: "GET",
    });
    if (error) throw new Error(error.message);
    return data ?? {};
  };

  const loadUsers = async () => {
    setState((current) => ({ ...current, loading: true, error: undefined }));
    try {
      const { data } = await supabase!.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session Supabase absente. Reconnecte-toi au panel admin.");

      let body: UsersResponse;
      try {
        body = await loadFromApi(token);
      } catch (apiError) {
        try {
          body = await loadFromEdgeFunction();
        } catch (edgeError) {
          throw new Error(`${(edgeError as Error).message} (${(apiError as Error).message})`);
        }
      }
      setState({
        loading: false,
        users: body.users ?? [],
        total: body.total ?? body.users?.length ?? 0,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: (error as Error).message,
      }));
    }
  };

  const inviteViaApi = async (token: string, email: string): Promise<InviteResponse> => {
    const res = await fetch(`${API_URL}/admin/users/invite`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });
    const body = (await res.json().catch(() => ({}))) as InviteResponse;
    if (!res.ok) throw new Error(body.error ?? `API admin HTTP ${res.status}`);
    return body;
  };

  const inviteViaEdgeFunction = async (email: string): Promise<InviteResponse> => {
    const { data, error } = await supabase!.functions.invoke<InviteResponse>("admin-users", {
      method: "POST",
      body: { email },
    });
    if (error) throw new Error(error.message);
    return data ?? {};
  };

  const inviteUser = async () => {
    const email = normalizeEmail(inviteEmail);
    setInviteMessage(undefined);
    setInviteError(undefined);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError("Entre un courriel valide.");
      return;
    }
    setInviting(true);
    try {
      const { data } = await supabase!.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session Supabase absente. Reconnecte-toi au panel admin.");

      try {
        await inviteViaApi(token, email);
      } catch (apiError) {
        try {
          await inviteViaEdgeFunction(email);
        } catch (edgeError) {
          throw new Error(`${(edgeError as Error).message} (${(apiError as Error).message})`);
        }
      }
      setInviteEmail("");
      setInviteMessage(`Invitation envoyée à ${email}.`);
      await loadUsers();
    } catch (error) {
      setInviteError((error as Error).message);
    } finally {
      setInviting(false);
    }
  };

  const copyEmails = async () => {
    const emails = visibleUsers.map((user) => user.email).filter(Boolean).join(", ");
    try {
      await navigator.clipboard.writeText(emails);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setInviteError("Copie impossible. Ton navigateur bloque peut-être le presse-papiers.");
    }
  };

  const exportUsersCsv = () => {
    const header = ["email", "role", "createdAt", "lastSignInAt", "confirmedAt", "providers"];
    const rows = visibleUsers.map((user) => [
      user.email,
      isAdminEmail(user.email) ? "admin" : "utilisateur",
      user.createdAt ?? "",
      user.lastSignInAt ?? "",
      user.confirmedAt ?? "",
      user.providers.join("; "),
    ]);
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jobccq-utilisateurs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (supabase) void loadUsers();
  }, []);

  return (
    <section className="card mb-4 p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">Utilisateurs</h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Comptes Supabase Auth, visibles et modifiables seulement par admin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadUsers()}
          disabled={state.loading || !supabase}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          {state.loading ? "Chargement..." : "Actualiser"}
        </button>
      </div>

      {!supabase ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
          Supabase n'est pas configuré dans ce build.
        </p>
      ) : state.error ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
          {state.error}
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Comptes", state.total],
              ["Admins", stats.adminCount],
              ["Confirmés", stats.confirmedCount],
              ["À confirmer", stats.unconfirmedCount],
              ["Actifs 30 j", stats.recentCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-50">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="grid gap-2 lg:grid-cols-[1fr_auto_auto_auto]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Chercher courriel, ID, connexion..."
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-500"
              />
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as UserFilter)}
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-50"
              >
                <option value="all">Tous</option>
                <option value="admin">Admins</option>
                <option value="confirmed">Confirmés</option>
                <option value="unconfirmed">Non confirmés</option>
                <option value="recent">Actifs 30 jours</option>
              </select>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as UserSort)}
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-50"
              >
                <option value="newest">Plus récents</option>
                <option value="oldest">Plus anciens</option>
                <option value="email">Courriel A-Z</option>
                <option value="lastSignIn">Dernière connexion</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void copyEmails()}
                  disabled={visibleUsers.length === 0}
                  className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  {copied ? "Copié" : "Copier courriels"}
                </button>
                <button
                  type="button"
                  onClick={exportUsersCsv}
                  disabled={visibleUsers.length === 0}
                  className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Export CSV
                </button>
              </div>
            </div>

            <form
              className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                void inviteUser();
              }}
            >
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="courriel@exemple.com"
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={inviting || state.loading}
                className="min-h-10 rounded-lg bg-sky-700 px-4 text-xs font-bold text-white hover:bg-sky-800 disabled:opacity-50 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
              >
                {inviting ? "Invitation..." : "Inviter"}
              </button>
            </form>
            {inviteMessage ? (
              <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{inviteMessage}</p>
            ) : null}
            {inviteError ? (
              <p className="mt-2 text-xs font-semibold text-rose-700 dark:text-rose-300">{inviteError}</p>
            ) : null}
          </div>

          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {visibleUsers.length} affiché{visibleUsers.length > 1 ? "s" : ""} sur {state.total}.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-700">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Courriel</th>
                  <th className="px-3 py-2 font-semibold">Rôle</th>
                  <th className="px-3 py-2 font-semibold">Créé</th>
                  <th className="px-3 py-2 font-semibold">Dernière connexion</th>
                  <th className="px-3 py-2 font-semibold">Confirmé</th>
                  <th className="px-3 py-2 font-semibold">Connexion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="max-w-[16rem] break-all py-2 pr-3 font-medium text-slate-800 dark:text-slate-100">
                      {user.email}
                    </td>
                    <td className="px-3 py-2">
                      <span className={isAdminEmail(user.email) ? "font-bold text-sky-700 dark:text-sky-300" : "text-slate-600 dark:text-slate-300"}>
                        {isAdminEmail(user.email) ? "Admin" : "Utilisateur"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatDate(user.createdAt)}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatDate(user.lastSignInAt)}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatDate(user.confirmedAt)}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                      {user.providers.length ? user.providers.join(", ") : "email"}
                    </td>
                  </tr>
                ))}
                {!state.loading && visibleUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-500 dark:text-slate-400">
                      Aucun compte trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
