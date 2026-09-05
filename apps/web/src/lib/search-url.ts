/**
 * Encodage ⇄ décodage de l'état des filtres de recherche dans l'URL.
 *
 * Sert à trois choses : des **URL de recherche partageables** (l'état des
 * filtres vit dans la query string), l'amorçage de l'explorateur depuis un lien
 * profond (accueil, pages SEO), et les **recherches enregistrées** (une
 * recherche = sa query string). Les noms de paramètres restent compatibles avec
 * les liens existants (`q`, `cities`, `categories`, `regions`, `sources`).
 */
import type { SortOption } from "@jobccq/shared";
import { SORT_OPTIONS } from "@jobccq/shared";

export interface SearchFilters {
  q: string;
  city: string;
  regions: string[];
  categories: string[];
  employmentTypes: string[];
  remote: string[];
  sources: string[];
  languages: string[];
  salaryMin: string;
  postedWithinDays: string;
  ccqOnly: boolean;
  sort: SortOption;
  page: number;
}

export const EMPTY_FILTERS: SearchFilters = {
  q: "",
  city: "",
  regions: [],
  categories: [],
  employmentTypes: [],
  remote: [],
  sources: [],
  languages: [],
  salaryMin: "",
  postedWithinDays: "",
  ccqOnly: false,
  sort: "recent",
  page: 1,
};

const MULTI_KEYS = [
  "regions",
  "categories",
  "employmentTypes",
  "remote",
  "sources",
  "languages",
] as const;

/** Y a-t-il au moins un critère actif (hors tri/pagination) ? */
export function hasActiveFilters(f: SearchFilters): boolean {
  return (
    !!f.q ||
    !!f.city ||
    !!f.salaryMin ||
    !!f.postedWithinDays ||
    f.ccqOnly ||
    MULTI_KEYS.some((k) => f[k].length > 0)
  );
}

/** État des filtres → paramètres d'URL (n'écrit que les champs renseignés). */
export function filtersToParams(f: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.city) p.set("cities", f.city);
  for (const k of MULTI_KEYS) if (f[k].length) p.set(k, f[k].join(","));
  if (f.salaryMin) p.set("salaryMin", f.salaryMin);
  if (f.postedWithinDays) p.set("postedWithinDays", f.postedWithinDays);
  if (f.ccqOnly) p.set("ccqOnly", "1");
  if (f.sort && f.sort !== "recent") p.set("sort", f.sort);
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}

/** État des filtres → query string (« a=b&c=d », sans « ? » ; vide si aucun). */
export function filtersToQueryString(f: SearchFilters): string {
  return filtersToParams(f).toString();
}

const splitList = (v: string | null): string[] =>
  v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];

/** Paramètres d'URL → état des filtres complet (fusionnés sur les valeurs par défaut). */
export function parseFilters(params: URLSearchParams): SearchFilters {
  const sortRaw = params.get("sort");
  const sort = (SORT_OPTIONS as readonly string[]).includes(sortRaw ?? "")
    ? (sortRaw as SortOption)
    : "recent";
  const pageRaw = Number(params.get("page"));
  return {
    q: params.get("q") ?? "",
    // On accepte `cities` (compat) et n'en garde que la première ville.
    city: splitList(params.get("cities"))[0] ?? "",
    regions: splitList(params.get("regions")),
    categories: splitList(params.get("categories")),
    employmentTypes: splitList(params.get("employmentTypes")),
    remote: splitList(params.get("remote")),
    sources: splitList(params.get("sources")),
    languages: splitList(params.get("languages")),
    salaryMin: params.get("salaryMin") ?? "",
    postedWithinDays: params.get("postedWithinDays") ?? "",
    ccqOnly: params.get("ccqOnly") === "1",
    sort,
    page: Number.isFinite(pageRaw) && pageRaw > 1 ? Math.floor(pageRaw) : 1,
  };
}

/** Décode une query string enregistrée (« q=…&regions=… ») en filtres. */
export function parseFiltersFromQueryString(qs: string): SearchFilters {
  return parseFilters(new URLSearchParams(qs));
}
