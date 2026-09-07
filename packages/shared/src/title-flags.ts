/**
 * Signaux d'un titre d'offre louche (spam, clickbait, pas un métier).
 * Règles conservatrices : les VRAIS intitulés CCQ en majuscules passent.
 */

export interface TitleFlag {
  id: string;
  label: string;
}

const LETTERS = /[\p{L}]/gu;
const EMOJI = /\p{Extended_Pictographic}/gu;

/** `&amp;`, `&#39;`, `&#x27;` — reste de scrape mal décodé. */
const HTML_ENTITY = /&(?:#(?:x[0-9a-f]+|\d+)|[a-z][a-z0-9]+);/i;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Décode les entités HTML d'un intitulé (`d&#39;engins` → `d'engins`). */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => {
      const code = Number.parseInt(n, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    })
    .replace(/&([a-z][a-z0-9]+);/gi, (all, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? all);
}

/** Titre prêt à afficher (entités HTML décodées). */
export function displayJobTitle(title: string): string {
  return decodeHtmlEntities(title ?? "").replace(/\s+/g, " ").trim();
}

function lettersOf(title: string): string {
  return (title.match(LETTERS) ?? []).join("");
}

/** Premier signal trouvé, ou null si le titre a l'air d'un vrai poste. */
export function flagWeirdTitle(title: string): TitleFlag | null {
  const raw = (title ?? "").trim();
  if (!raw) return { id: "vide", label: "Titre vide" };

  if (HTML_ENTITY.test(raw)) return { id: "entites", label: "Entités HTML dans le titre" };

  const letters = lettersOf(raw);
  if (letters.length < 4) return { id: "court", label: "Titre trop court" };

  if (/https?:\/\/|www\./i.test(raw)) return { id: "url", label: "Titre avec URL" };
  if (/[^\s]+@[^\s]+\.[a-z]{2,}/i.test(raw)) return { id: "courriel", label: "Titre avec courriel" };

  if (/(.)\1{4,}/.test(raw)) return { id: "repetition", label: "Caractères répétés" };
  if (/!{2,}|\${2,}|€{2,}|\?{3,}/.test(raw)) return { id: "spam", label: "Ponctuation / $ spam" };

  const emojis = raw.match(EMOJI) ?? [];
  if (emojis.length >= 2) return { id: "emoji", label: "Émojis dans le titre" };

  if (
    /argent\s+facile|gagnez?\s+(de\s+l['’]argent|\$)|travail\s+facile|cliquez\s+ici|make\s+money|work\s+from\s+home\s+\$|paiement\s+[àa]\s+l['’]avance/i.test(
      raw,
    )
  ) {
    return { id: "clickbait", label: "Titre racoleur" };
  }

  if (/lorem ipsum|\btest\s+offre\b|asdf|qwerty|\bxxx+\b/i.test(raw)) {
    return { id: "placeholder", label: "Titre factice" };
  }

  const symbols = raw.replace(/[\p{L}\p{N}\s'’\-–—,.]/gu, "");
  if (raw.length >= 8 && symbols.length / raw.length > 0.28) {
    return { id: "symboles", label: "Trop de symboles" };
  }

  // Majuscules + signes d'alarme (les vrais « ÉLECTRICIEN » restent OK).
  const upperLetters = (letters.match(/\p{Lu}/gu) ?? []).length;
  if (
    letters.length >= 10 &&
    upperLetters / letters.length > 0.85 &&
    /!|\$|urgent|wow|incroyable|click/i.test(raw)
  ) {
    return { id: "caps", label: "MAJUSCULES + alerte" };
  }

  return null;
}

export function isWeirdTitle(title: string): boolean {
  return flagWeirdTitle(title) !== null;
}
