"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/data";
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

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function AdminUsers() {
  const [state, setState] = useState<UsersState>({ loading: false, users: [], total: 0 });

  const loadUsers = async () => {
    setState((current) => ({ ...current, loading: true, error: undefined }));
    try {
      const { data } = await supabase!.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session Supabase absente. Reconnecte-toi au panel admin.");

      const res = await fetch(`${API_URL}/admin/users?perPage=200`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as {
        users?: AdminUserRow[];
        total?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `API admin HTTP ${res.status}`);
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

  useEffect(() => {
    if (supabase) void loadUsers();
  }, []);

  return (
    <section className="card mb-4 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">Utilisateurs</h2>
          <p className="mt-1 text-xs text-slate-600">
            Comptes créés dans Supabase Auth. Visible seulement dans le panel admin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadUsers()}
          disabled={state.loading || !supabase}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          {state.loading ? "Chargement…" : "Actualiser"}
        </button>
      </div>

      {!supabase ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
          Supabase n'est pas configuré dans ce build.
        </p>
      ) : state.error ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
          {state.error}
        </p>
      ) : (
        <>
          <p className="mt-3 text-xs text-slate-500">
            {state.total} compte{state.total > 1 ? "s" : ""}.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Courriel</th>
                  <th className="px-3 py-2 font-semibold">Créé</th>
                  <th className="px-3 py-2 font-semibold">Dernière connexion</th>
                  <th className="px-3 py-2 font-semibold">Confirmé</th>
                  <th className="px-3 py-2 font-semibold">Connexion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.users.map((user) => (
                  <tr key={user.id}>
                    <td className="max-w-[16rem] break-all py-2 pr-3 font-medium text-slate-800">
                      {user.email}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(user.createdAt)}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(user.lastSignInAt)}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(user.confirmedAt)}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {user.providers.length ? user.providers.join(", ") : "email"}
                    </td>
                  </tr>
                ))}
                {!state.loading && state.users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-500">
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
