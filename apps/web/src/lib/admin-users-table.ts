/** Logique pure du tableau admin « Utilisateurs » — testable hors React. */

export type AdminUserRow = {
  id: string;
  email: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  confirmedAt: string | null;
  providers: string[];
};

export type UserFilter = "all" | "admin" | "confirmed" | "unconfirmed" | "recent" | "never";
export type UserSortKey = "email" | "createdAt" | "lastSignInAt" | "confirmedAt";
export type UserSortDir = "asc" | "desc";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function isRecent(value: string | null, now = Date.now()): boolean {
  const t = sortDate(value);
  return t > 0 && now - t <= THIRTY_DAYS_MS;
}

export function sortDate(value: string | null): number {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function formatAbsoluteDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** Date courte + relative (ex. « il y a 2 j »). */
export function formatRelativeDate(value: string | null, now = Date.now()): string {
  const t = sortDate(value);
  if (!t) return "jamais";
  const delta = Math.max(0, now - t);
  const min = Math.round(delta / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "hier";
  if (d < 45) return `il y a ${d} j`;
  return formatAbsoluteDate(value);
}

export function matchesUserQuery(user: AdminUserRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    user.email.toLowerCase().includes(needle) ||
    user.id.toLowerCase().includes(needle) ||
    user.providers.some((p) => p.toLowerCase().includes(needle))
  );
}

export function filterUsers(
  users: readonly AdminUserRow[],
  filter: UserFilter,
  query: string,
  isAdmin: (email: string) => boolean,
  now = Date.now(),
): AdminUserRow[] {
  return users.filter((user) => {
    if (!matchesUserQuery(user, query)) return false;
    if (filter === "admin") return isAdmin(user.email);
    if (filter === "confirmed") return !!user.confirmedAt;
    if (filter === "unconfirmed") return !user.confirmedAt;
    if (filter === "recent") return isRecent(user.lastSignInAt, now);
    if (filter === "never") return !user.lastSignInAt;
    return true;
  });
}

export function sortUsers(
  users: readonly AdminUserRow[],
  key: UserSortKey,
  dir: UserSortDir,
): AdminUserRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...users].sort((a, b) => {
    if (key === "email") return sign * a.email.localeCompare(b.email, "fr-CA");
    return sign * (sortDate(a[key]) - sortDate(b[key]));
  });
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number): T[] {
  const start = Math.max(0, (page - 1) * pageSize);
  return items.slice(start, start + pageSize);
}
