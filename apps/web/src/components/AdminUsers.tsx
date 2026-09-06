"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/data";
import { isAdminEmail } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  filterUsers,
  formatAbsoluteDate,
  formatRelativeDate,
  paginate,
  sortUsers,
  type AdminUserRow,
  type UserFilter,
  type UserSortDir,
  type UserSortKey,
} from "@/lib/admin-users-table";

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

const PAGE_SIZE = 25;

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "sky" | "slate" | "amber" | "emerald" | "rose";
}) {
  const cls = {
    sky: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
    rose: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  }[tone];
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{children}</span>
  );
}

function SortTh({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: UserSortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  const ariaSort = active ? (dir === "asc" ? "ascending" : "descending") : "none";
  return (
    <th
      aria-sort={ariaSort}
      className={`py-2 font-semibold ${align === "right" ? "px-3 text-right" : "pr-3 text-left"}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white ${
          active ? "text-slate-900 dark:text-white" : ""
        }`}
      >
        {label}
        <span className="text-[10px] text-slate-400" aria-hidden>
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

export function AdminUsers() {
  const [state, setState] = useState<UsersState>({ loading: false, users: [], total: 0 });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [sortKey, setSortKey] = useState<UserSortKey>("createdAt");
  const [sortDir, setSortDir] = useState<UserSortDir>("desc");
  const [page, setPage] = useState(1);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState<string | undefined>();
  const [inviteError, setInviteError] = useState<string | undefined>();
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState("");

  const stats = useMemo(() => {
    const adminCount = state.users.filter((user) => isAdminEmail(user.email)).length;
    const confirmedCount = state.users.filter((user) => !!user.confirmedAt).length;
    const recentCount = state.users.filter((user) => {
      const t = user.lastSignInAt ? Date.parse(user.lastSignInAt) : 0;
      return t > 0 && Date.now() - t <= 30 * 24 * 60 * 60 * 1000;
    }).length;
    const neverCount = state.users.filter((user) => !user.lastSignInAt).length;
    return {
      adminCount,
      confirmedCount,
      recentCount,
      neverCount,
      unconfirmedCount: Math.max(0, state.users.length - confirmedCount),
    };
  }, [state.users]);

  const visibleUsers = useMemo(
    () => sortUsers(filterUsers(state.users, filter, query, isAdminEmail), sortKey, sortDir),
    [filter, query, sortDir, sortKey, state.users],
  );

  const pageCount = Math.max(1, Math.ceil(visibleUsers.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = paginate(visibleUsers, safePage, PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filter, query, sortKey, sortDir]);

  const toggleSort = (key: UserSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "email" ? "asc" : "desc");
    }
  };

  const flashCopied = (id: string) => {
    setCopied(id);
    window.setTimeout(() => setCopied((c) => (c === id ? "" : c)), 1600);
  };

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flashCopied(id);
    } catch {
      setInviteError("Copie impossible. Ton navigateur bloque peut-être le presse-papiers.");
    }
  };

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
    await copyText(emails, "all");
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

  const kpis: { label: string; value: number; filter: UserFilter }[] = [
    { label: "Comptes", value: state.total, filter: "all" },
    { label: "Admins", value: stats.adminCount, filter: "admin" },
    { label: "Confirmés", value: stats.confirmedCount, filter: "confirmed" },
    { label: "À confirmer", value: stats.unconfirmedCount, filter: "unconfirmed" },
    { label: "Actifs 30 j", value: stats.recentCount, filter: "recent" },
    { label: "Jamais vus", value: stats.neverCount, filter: "never" },
  ];

  return (
    <section className="card mb-4 p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">Utilisateurs</h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Comptes Supabase Auth. Clique une carte pour filtrer, un en-tête pour trier.
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
          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {kpis.map((k) => {
              const on = filter === k.filter;
              return (
                <button
                  key={k.filter}
                  type="button"
                  onClick={() => setFilter(k.filter)}
                  className={`rounded-lg border p-3 text-left transition ${
                    on
                      ? "border-brand-400 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/15"
                      : "border-slate-200 hover:border-brand-300 dark:border-slate-700 dark:hover:border-brand-500"
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{k.label}</p>
                  <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-50">{k.value}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="grid gap-2 lg:grid-cols-[1fr_auto_auto]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Chercher courriel, ID, connexion…"
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
                <option value="never">Jamais connectés</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void copyEmails()}
                  disabled={visibleUsers.length === 0}
                  className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  {copied === "all" ? "Copié" : "Copier courriels"}
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

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <p>
              {visibleUsers.length} affiché{visibleUsers.length > 1 ? "s" : ""} sur {state.total}
              {pageCount > 1 ? ` · page ${safePage}/${pageCount}` : ""}
              {state.loading ? " · chargement…" : ""}
              {(filter !== "all" || query.trim()) && (
                <>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => {
                      setFilter("all");
                      setQuery("");
                    }}
                    className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
                  >
                    Réinitialiser
                  </button>
                </>
              )}
            </p>
            {pageCount > 1 && (
              <span className="flex gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40 dark:border-slate-600"
                >
                  Préc.
                </button>
                <button
                  type="button"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  className="rounded border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40 dark:border-slate-600"
                >
                  Suiv.
                </button>
              </span>
            )}
          </div>

          <div className="mt-2 max-h-[36rem] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <SortTh label="Courriel" active={sortKey === "email"} dir={sortDir} onClick={() => toggleSort("email")} />
                  <th className="px-3 py-2 font-semibold">Statut</th>
                  <SortTh
                    label="Inscrit"
                    active={sortKey === "createdAt"}
                    dir={sortDir}
                    onClick={() => toggleSort("createdAt")}
                  />
                  <SortTh
                    label="Dernière visite"
                    active={sortKey === "lastSignInAt"}
                    dir={sortDir}
                    onClick={() => toggleSort("lastSignInAt")}
                  />
                  <th className="px-3 py-2 font-semibold">Connexion</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pageRows.map((user) => {
                  const admin = isAdminEmail(user.email);
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      <td className="max-w-[18rem] py-2.5 pl-3 pr-3">
                        <a
                          href={`mailto:${user.email}`}
                          className="break-all font-medium text-slate-800 hover:text-brand-700 dark:text-slate-100"
                        >
                          {user.email}
                        </a>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400" title={user.id}>
                          {user.id.slice(0, 8)}…
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex flex-wrap gap-1">
                          <Badge tone={admin ? "sky" : "slate"}>{admin ? "Admin" : "Compte"}</Badge>
                          {user.confirmedAt ? (
                            <Badge tone="emerald">Confirmé</Badge>
                          ) : (
                            <Badge tone="amber">À confirmer</Badge>
                          )}
                          {!user.lastSignInAt ? <Badge tone="rose">Jamais vu</Badge> : null}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300" title={formatAbsoluteDate(user.createdAt)}>
                        {formatRelativeDate(user.createdAt)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-slate-600 dark:text-slate-300"
                        title={formatAbsoluteDate(user.lastSignInAt)}
                      >
                        {formatRelativeDate(user.lastSignInAt)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                        {user.providers.length ? user.providers.join(", ") : "email"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => void copyText(user.email, user.id)}
                          className="font-semibold text-brand-700 hover:underline"
                        >
                          {copied === user.id ? "Copié" : "Copier"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!state.loading && visibleUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                      Aucun compte dans ce filtre.
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
