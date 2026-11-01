"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/data";
import { isAdminEmail, useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  filterUsers,
  formatAbsoluteDate,
  formatRelativeDate,
  isUserBanned,
  paginate,
  sortUsers,
  type AdminUserRow,
  type UserFilter,
  type UserLoginActivity,
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
  const { user: me } = useAuth();
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
  const [expanded, setExpanded] = useState("");
  const [activity, setActivity] = useState<Record<string, { loading: boolean; rows: UserLoginActivity[]; note?: string }>>({});
  const [actionLink, setActionLink] = useState<{ id: string; link: string } | null>(null);
  const [busy, setBusy] = useState("");

  const stats = useMemo(() => {
    const adminCount = state.users.filter((user) => isAdminEmail(user.email)).length;
    const confirmedCount = state.users.filter((user) => !!user.confirmedAt).length;
    const recentCount = state.users.filter((user) => {
      const t = user.lastSignInAt ? Date.parse(user.lastSignInAt) : 0;
      return t > 0 && Date.now() - t <= 30 * 24 * 60 * 60 * 1000;
    }).length;
    const neverCount = state.users.filter((user) => !user.lastSignInAt).length;
    const bannedCount = state.users.filter((user) => isUserBanned(user)).length;
    return {
      adminCount,
      confirmedCount,
      recentCount,
      neverCount,
      bannedCount,
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

  /** POST authentifié vers l'API admin. Lève une erreur parlante. */
  const adminPost = async <T,>(path: string, payload: Record<string, unknown>): Promise<T> => {
    const { data } = await supabase!.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Session Supabase absente. Reconnecte-toi au panel admin.");
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new Error(body.error ?? `API admin HTTP ${res.status}`);
    return body;
  };

  const protectedTarget = (target: AdminUserRow): boolean =>
    isAdminEmail(target.email) || target.email === me?.email;

  const setBan = async (target: AdminUserRow, ban: boolean, durationHours?: number) => {
    setInviteMessage(undefined);
    setInviteError(undefined);
    if (ban && protectedTarget(target)) {
      setInviteError("On ne bannit pas un admin ni son propre compte.");
      return;
    }
    const labelDur = durationHours === 24 ? "24 h" : durationHours === 168 ? "7 jours" : "en permanence";
    if (ban && !confirm(`Bannir ${target.email} ${labelDur} ? Il ne pourra plus se connecter.`)) return;
    setBusy(target.id);
    try {
      try {
        await adminPost(`/admin/users/ban`, { userId: target.id, ban, durationHours });
      } catch (apiError) {
        const { data: edge, error } = await supabase!.functions.invoke<{ error?: string }>("admin-users", {
          method: "POST",
          body: { userId: target.id, ban, durationHours },
        });
        if (error) throw new Error(`${error.message} (${(apiError as Error).message})`);
        if (edge?.error) throw new Error(edge.error);
      }
      setInviteMessage(ban ? `${target.email} est banni (${labelDur}).` : `${target.email} n'est plus banni.`);
      await loadUsers();
    } catch (error) {
      setInviteError((error as Error).message);
    } finally {
      setBusy("");
    }
  };

  const deleteUser = async (target: AdminUserRow) => {
    setInviteMessage(undefined);
    setInviteError(undefined);
    if (protectedTarget(target)) {
      setInviteError("On ne supprime pas un admin ni son propre compte.");
      return;
    }
    if (!confirm(`Supprimer définitivement ${target.email} ? Cette action est irréversible.`)) return;
    setBusy(target.id);
    try {
      await adminPost(`/admin/users/delete`, { userId: target.id });
      setInviteMessage(`${target.email} supprimé.`);
      setExpanded("");
      await loadUsers();
    } catch (error) {
      setInviteError((error as Error).message);
    } finally {
      setBusy("");
    }
  };

  const confirmEmail = async (target: AdminUserRow) => {
    setInviteMessage(undefined);
    setInviteError(undefined);
    setBusy(target.id);
    try {
      await adminPost(`/admin/users/confirm-email`, { userId: target.id });
      setInviteMessage(`Courriel de ${target.email} confirmé.`);
      await loadUsers();
    } catch (error) {
      setInviteError((error as Error).message);
    } finally {
      setBusy("");
    }
  };

  const sendActionLink = async (target: AdminUserRow, kind: "recovery" | "magiclink") => {
    setInviteMessage(undefined);
    setInviteError(undefined);
    setActionLink(null);
    setBusy(target.id);
    try {
      const body = await adminPost<{ link?: string | null }>(`/admin/users/action-link`, {
        userId: target.id,
        kind,
      });
      if (body.link) {
        setActionLink({ id: target.id, link: body.link });
        setInviteMessage(
          `Lien ${kind === "recovery" ? "de réinitialisation" : "de connexion"} généré pour ${target.email}.`,
        );
      } else {
        setInviteMessage(`Lien envoyé à ${target.email} (si un courriel est configuré).`);
      }
    } catch (error) {
      setInviteError((error as Error).message);
    } finally {
      setBusy("");
    }
  };

  const loadActivity = async (userId: string) => {
    setActivity((a) => ({ ...a, [userId]: { loading: true, rows: a[userId]?.rows ?? [] } }));
    try {
      const { data } = await supabase!.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session absente.");
      const res = await fetch(`${API_URL}/admin/users/${userId}/activity`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as {
        activity?: UserLoginActivity[];
        note?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setActivity((a) => ({ ...a, [userId]: { loading: false, rows: body.activity ?? [], note: body.note } }));
    } catch (error) {
      setActivity((a) => ({ ...a, [userId]: { loading: false, rows: [], note: (error as Error).message } }));
    }
  };

  const toggleExpand = (userId: string) => {
    setExpanded((cur) => {
      const next = cur === userId ? "" : userId;
      if (next && !activity[userId]) void loadActivity(userId);
      return next;
    });
  };

  const copyEmails = async () => {
    const emails = visibleUsers.map((user) => user.email).filter(Boolean).join(", ");
    await copyText(emails, "all");
  };

  const exportUsersCsv = () => {
    const header = ["email", "role", "createdAt", "lastSignInAt", "confirmedAt", "providers", "bannedUntil"];
    const rows = visibleUsers.map((user) => [
      user.email,
      isAdminEmail(user.email) ? "admin" : "utilisateur",
      user.createdAt ?? "",
      user.lastSignInAt ?? "",
      user.confirmedAt ?? "",
      user.providers.join("; "),
      user.bannedUntil ?? "",
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
    { label: "Bannis", value: stats.bannedCount, filter: "banned" },
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
          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
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
                <option value="banned">Bannis</option>
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
                  const mainRow = (
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
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
                          {isUserBanned(user) ? <Badge tone="rose">Banni</Badge> : null}
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
                        <span className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void copyText(user.email, user.id)}
                            className="font-semibold text-brand-700 hover:underline"
                          >
                            {copied === user.id ? "Copié" : "Copier"}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleExpand(user.id)}
                            aria-expanded={expanded === user.id}
                            className="font-semibold text-slate-600 hover:underline dark:text-slate-300"
                          >
                            {expanded === user.id ? "Masquer" : "Détails"}
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                  const detailRow =
                    expanded === user.id ? (
                      <tr key={`${user.id}-d`} className="bg-slate-50/70 dark:bg-slate-800/40">
                        <td colSpan={6} className="px-3 py-3">
                          <UserDetail
                            user={user}
                            admin={admin}
                            self={user.email === me?.email}
                            busy={busy === user.id}
                            activity={activity[user.id]}
                            actionLink={actionLink?.id === user.id ? actionLink.link : null}
                            onBan={(h) => void setBan(user, true, h)}
                            onUnban={() => void setBan(user, false)}
                            onDelete={() => void deleteUser(user)}
                            onConfirmEmail={() => void confirmEmail(user)}
                            onLink={(k) => void sendActionLink(user, k)}
                            onCopy={(text, id) => void copyText(text, id)}
                            copied={copied}
                          />
                        </td>
                      </tr>
                    ) : null;
                  return (
                    <Fragment key={user.id}>
                      {mainRow}
                      {detailRow}
                    </Fragment>
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

function geoText(row: UserLoginActivity): string {
  return [row.city, row.region, row.country].map((p) => (p ?? "").trim()).filter(Boolean).join(", ");
}

/** Panneau de détails d'un compte : infos riches, actions, connexions (IP/géoIP). */
function UserDetail({
  user,
  admin,
  self,
  busy,
  activity,
  actionLink,
  onBan,
  onUnban,
  onDelete,
  onConfirmEmail,
  onLink,
  onCopy,
  copied,
}: {
  user: AdminUserRow;
  admin: boolean;
  self: boolean;
  busy: boolean;
  activity?: { loading: boolean; rows: UserLoginActivity[]; note?: string };
  actionLink: string | null;
  onBan: (hours?: number) => void;
  onUnban: () => void;
  onDelete: () => void;
  onConfirmEmail: () => void;
  onLink: (kind: "recovery" | "magiclink") => void;
  onCopy: (text: string, id: string) => void;
  copied: string;
}) {
  const banned = isUserBanned(user);
  const protectedAcc = admin || self;
  const btn =
    "rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700";
  const danger =
    "rounded-md border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/50 dark:text-red-300 dark:hover:bg-red-950/40";

  const info: Array<[string, React.ReactNode]> = [
    ["Identifiant", <span key="id" className="font-mono text-[11px] break-all">{user.id}</span>],
    ["Nom affiché", user.displayName || "—"],
    ["Téléphone", user.phone || "—"],
    ["Rôle", admin ? "Admin" : user.role || "utilisateur"],
    ["Fournisseurs", user.providers.length ? user.providers.join(", ") : "email"],
    ["Anonyme", user.isAnonymous ? "oui" : "non"],
    ["MFA (facteurs)", String(user.mfaFactors ?? 0)],
    ["Inscrit", formatAbsoluteDate(user.createdAt)],
    ["Dernière visite", formatAbsoluteDate(user.lastSignInAt)],
    ["Mis à jour", formatAbsoluteDate(user.updatedAt ?? null)],
    ["Courriel confirmé", user.confirmedAt ? formatAbsoluteDate(user.confirmedAt) : "non"],
    ["Banni jusqu'à", banned ? formatAbsoluteDate(user.bannedUntil ?? null) : "—"],
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Infos */}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Informations</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          {info.map(([k, v]) => (
            <Fragment key={k}>
              <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
              <dd className="text-slate-800 dark:text-slate-100">{v}</dd>
            </Fragment>
          ))}
        </dl>
        <button
          type="button"
          onClick={() => onCopy(user.id, `uid-${user.id}`)}
          className="mt-2 text-[11px] font-semibold text-brand-700 hover:underline"
        >
          {copied === `uid-${user.id}` ? "ID copié" : "Copier l'ID"}
        </button>
      </div>

      {/* Actions + activité */}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Actions</p>
        {protectedAcc ? (
          <p className="text-xs text-slate-500">Compte protégé (admin ou toi-même) : actions désactivées.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {banned ? (
              <button type="button" disabled={busy} onClick={onUnban} className={btn}>
                Débannir
              </button>
            ) : (
              <>
                <button type="button" disabled={busy} onClick={() => onBan(24)} className={btn}>
                  Bannir 24 h
                </button>
                <button type="button" disabled={busy} onClick={() => onBan(168)} className={btn}>
                  Bannir 7 j
                </button>
                <button type="button" disabled={busy} onClick={() => onBan()} className={btn}>
                  Bannir ∞
                </button>
              </>
            )}
            {!user.confirmedAt ? (
              <button type="button" disabled={busy} onClick={onConfirmEmail} className={btn}>
                Confirmer le courriel
              </button>
            ) : null}
            <button type="button" disabled={busy} onClick={() => onLink("recovery")} className={btn}>
              Lien réinit. MDP
            </button>
            <button type="button" disabled={busy} onClick={() => onLink("magiclink")} className={btn}>
              Lien magique
            </button>
            <button type="button" disabled={busy} onClick={onDelete} className={danger}>
              Supprimer
            </button>
          </div>
        )}

        {actionLink ? (
          <div className="mt-3">
            <p className="mb-1 text-[11px] font-semibold text-slate-500">Lien généré (à transmettre) :</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={actionLink}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={() => onCopy(actionLink, `link-${user.id}`)}
                className={btn}
              >
                {copied === `link-${user.id}` ? "Copié" : "Copier"}
              </button>
            </div>
          </div>
        ) : null}

        {/* Connexions (IP + géoIP) */}
        <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Connexions récentes (IP &amp; géoloc.)
        </p>
        {activity?.loading ? (
          <p className="text-xs text-slate-500">Chargement…</p>
        ) : activity && activity.rows.length > 0 ? (
          <ul className="space-y-1 text-xs">
            {activity.rows.map((row, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-slate-700 dark:text-slate-200">
                <span className="font-mono">{row.ip ?? "—"}</span>
                {geoText(row) ? <span className="text-slate-500">· {geoText(row)}</span> : null}
                <span className="text-slate-400">· {formatAbsoluteDate(row.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">
            Aucune connexion enregistrée pour l'instant.
            {activity?.note ? <span className="block text-slate-400">({activity.note})</span> : null}
          </p>
        )}
      </div>
    </div>
  );
}
