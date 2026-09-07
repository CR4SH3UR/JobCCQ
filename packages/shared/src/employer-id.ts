/**
 * Identifiants d'employeur (slug) : normalisation et changement d'id.
 *
 * Forme attendue : `ma-compagnie-com` — minuscules, chiffres, tirets.
 * Un changement d'id doit rester un slug, distinct de l'actuel, et libre.
 */

/** Slug minuscule : un ou plusieurs segments `[a-z0-9]+` séparés par `-`. */
export const EMPLOYER_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type EmployerIdChangeError = "empty" | "invalid" | "unchanged" | "taken";

export type EmployerIdChangeResult =
  | { ok: true; newId: string }
  | { ok: false; error: EmployerIdChangeError; message: string };

const MESSAGES: Record<EmployerIdChangeError, string> = {
  empty: "L'id ne peut pas être vide.",
  invalid: "L'id doit être un slug minuscule (lettres, chiffres, tirets), ex. ma-compagnie-com.",
  unchanged: "Le nouvel id est identique à l'actuel.",
  taken: "Cet id est déjà utilisé par une autre entreprise.",
};

/** Réduit une saisie (accents, espaces, ponctuation) vers un slug d'id. */
export function normalizeEmployerId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function idSet(ids: ReadonlySet<string> | readonly string[]): Set<string> {
  return ids instanceof Set ? ids : new Set(ids);
}

/** Valide un changement d'id (normalise la proposition, refuse collision / no-op). */
export function validateEmployerIdChange(
  currentId: string,
  proposed: string,
  existingIds: ReadonlySet<string> | readonly string[],
): EmployerIdChangeResult {
  const newId = normalizeEmployerId(proposed);
  if (!newId) return { ok: false, error: "empty", message: MESSAGES.empty };
  if (!EMPLOYER_ID_RE.test(newId)) {
    return { ok: false, error: "invalid", message: MESSAGES.invalid };
  }
  if (newId === currentId) {
    return { ok: false, error: "unchanged", message: MESSAGES.unchanged };
  }
  if (idSet(existingIds).has(newId)) {
    return { ok: false, error: "taken", message: `L'id « ${newId} » est déjà utilisé.` };
  }
  return { ok: true, newId };
}

/** Réécrit l'id d'une fiche dans une liste (les autres fiches inchangées). */
export function renameEmployerInList<T extends { id: string }>(
  list: readonly T[],
  oldId: string,
  newId: string,
): T[] {
  return list.map((e) => (e.id === oldId ? { ...e, id: newId } : e));
}

/** Déplace la valeur d'une clé `oldId` vers `newId` dans un dictionnaire. */
export function remapKeyedRecord<T>(
  map: Readonly<Record<string, T>>,
  oldId: string,
  newId: string,
): Record<string, T> {
  if (oldId === newId || !(oldId in map)) return { ...map };
  const next = { ...map };
  next[newId] = next[oldId] as T;
  delete next[oldId];
  return next;
}

/** Remplace `oldId` par `newId` dans un ensemble. */
export function remapIdSet(ids: ReadonlySet<string>, oldId: string, newId: string): Set<string> {
  const next = new Set(ids);
  if (next.has(oldId)) {
    next.delete(oldId);
    next.add(newId);
  }
  return next;
}
