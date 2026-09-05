/**
 * Normalisation et comparaison **floue** de texte — partagées par la recherche
 * (filtrage) et l'autocomplétion. Fonctions pures, testables hors-ligne.
 */

/** Minuscule, sans accents ni ligatures — pour une comparaison tolérante. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    // Ligatures : « manœuvre » ↔ « manoeuvre » (NFD ne décompose pas œ/æ).
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // enlève les accents
}

/**
 * Distance de Levenshtein **bornée** : renvoie la distance d'édition entre `a`
 * et `b`, ou `max + 1` dès qu'on est certain de dépasser `max`. La sortie
 * anticipée garde l'appel rapide même sur de gros volumes.
 */
export function boundedLevenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  if (la === 0) return lb <= max ? lb : max + 1;
  if (lb === 0) return la <= max ? la : max + 1;

  // Int32Array : indexation typée `number` (pas d'`undefined`) et rapide.
  let prev = new Int32Array(lb + 1);
  let curr = new Int32Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let best = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      // Indices toujours dans les bornes (0..lb) : accès sûrs.
      const v = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
      curr[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1; // toute la ligne dépasse déjà : inutile de continuer
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  const dist = prev[lb]!;
  return dist <= max ? dist : max + 1;
}

/**
 * Tolérance aux fautes selon la longueur du mot : les mots courts n'en ont pas
 * (trop de faux positifs), les plus longs en tolèrent 1 à 2.
 */
export function typoTolerance(word: string): number {
  if (word.length >= 8) return 2;
  if (word.length >= 5) return 1;
  return 0;
}

/**
 * `normalizedWord` apparaît-il dans `normalizedHaystack`, à quelques fautes
 * près ? Sous-chaîne exacte d'abord ; sinon comparaison floue mot à mot (seuil
 * fonction de la longueur). `normalizedWord` et `normalizedHaystack` sont
 * supposés déjà normalisés (voir `normalizeText`).
 */
export function fuzzyIncludes(normalizedHaystack: string, normalizedWord: string): boolean {
  if (!normalizedWord) return true;
  if (normalizedHaystack.includes(normalizedWord)) return true;
  const max = typoTolerance(normalizedWord);
  if (max === 0) return false;
  for (const token of normalizedHaystack.split(/[^a-z0-9]+/)) {
    if (!token || Math.abs(token.length - normalizedWord.length) > max) continue;
    if (boundedLevenshtein(token, normalizedWord, max) <= max) return true;
  }
  return false;
}
