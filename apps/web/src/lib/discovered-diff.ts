/**
 * Diff entre deux versions de la liste d'employeurs (`discovered.json`), pour
 * **prévisualiser les changements avant publication**. Fonction pure et
 * testable : compare le fichier committé et la liste fusionnée à publier, et
 * renvoie les ajouts, retraits et modifications champ par champ.
 */

/** Sous-ensemble des champs d'employeur comparés (suffisant pour l'aperçu). */
export interface DiffEmployer {
  id: string;
  name?: string;
  careersUrl?: string;
  method?: string;
  careersUrl2?: string;
  method2?: string;
  region?: string;
  homepage?: string;
  rbq?: string;
  scope?: string;
  sectors?: readonly string[];
  verified?: boolean;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface ModifiedEmployer {
  id: string;
  name: string;
  changes: FieldChange[];
}

export interface DiscoveredDiff {
  added: DiffEmployer[];
  removed: DiffEmployer[];
  modified: ModifiedEmployer[];
  /** Nombre total d'entrées touchées. */
  total: number;
}

/** Champs comparés pour détecter une modification (ordre = ordre d'affichage). */
const COMPARED_FIELDS = [
  "name",
  "careersUrl",
  "method",
  "careersUrl2",
  "method2",
  "region",
  "homepage",
  "rbq",
  "scope",
  "sectors",
  "verified",
  "enabled",
] as const;

/**
 * Valeur normalisée d'un champ pour la comparaison. `enabled` absent vaut
 * « activé » (true) et `verified` absent vaut « non vérifié » (false) — c'est la
 * convention de `mergeForPublish` (champ omis quand il vaut sa valeur par
 * défaut), sinon on détecterait de faux changements.
 */
function normField(field: string, value: unknown): unknown {
  if (field === "enabled") return value === false ? false : true;
  if (field === "verified") return value === true ? true : false;
  return value ?? undefined;
}

/** Compare deux valeurs d'un champ donné (tableaux comparés par contenu). */
function sameValue(field: string, a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const aa = Array.isArray(a) ? a : [];
    const bb = Array.isArray(b) ? b : [];
    return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
  }
  return normField(field, a) === normField(field, b);
}

/** Diff de `before` (committé) vers `after` (à publier). */
export function diffDiscovered(
  before: readonly DiffEmployer[],
  after: readonly DiffEmployer[],
): DiscoveredDiff {
  const beforeById = new Map(before.map((e) => [e.id, e]));
  const afterById = new Map(after.map((e) => [e.id, e]));

  const added = after.filter((e) => !beforeById.has(e.id));
  const removed = before.filter((e) => !afterById.has(e.id));

  const modified: ModifiedEmployer[] = [];
  for (const a of after) {
    const b = beforeById.get(a.id);
    if (!b) continue; // ajout, déjà compté
    const changes: FieldChange[] = [];
    for (const f of COMPARED_FIELDS) {
      if (!sameValue(f, b[f], a[f])) changes.push({ field: f, before: b[f], after: a[f] });
    }
    if (changes.length) modified.push({ id: a.id, name: a.name ?? a.id, changes });
  }

  return { added, removed, modified, total: added.length + removed.length + modified.length };
}
