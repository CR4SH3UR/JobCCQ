/**
 * Types et validation du bandeau d'annonce — module **pur** (aucun alias `@/`,
 * aucun import de JSON), donc testable hors-ligne avec `node:test`. La config
 * du bundle et l'hydratation live vivent dans `banner.ts` / `banner-live.ts`.
 */

export const BANNER_TONES = ["amber", "brand", "slate", "green", "red", "blue"] as const;
export type BannerTone = (typeof BANNER_TONES)[number];

/** Lien optionnel du bandeau : aucun, lien externe, ou contact courriel (modale). */
export type BannerLink =
  | { readonly kind: "none" }
  | { readonly kind: "url"; readonly label: string; readonly href: string }
  | { readonly kind: "contact"; readonly label: string; readonly subject: string };

export interface BannerConfig {
  /** Afficher le bandeau. */
  readonly enabled: boolean;
  /** Identifiant de version : changer la valeur ré-affiche le bandeau à tous. */
  readonly id: string;
  /** Émoji de tête (ex. « 🚧 »). Vide = aucun. */
  readonly emoji: string;
  /** Segment en gras au début du message (ex. « Version beta »). Vide = aucun. */
  readonly title: string;
  /** Texte du bandeau. */
  readonly message: string;
  /** Couleur. */
  readonly tone: BannerTone;
  /** Le visiteur peut-il fermer le bandeau (mémorisé par `id`). */
  readonly dismissible: boolean;
  /** Lien d'action optionnel. */
  readonly link: BannerLink;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asTone(v: unknown): BannerTone {
  return BANNER_TONES.includes(v as BannerTone) ? (v as BannerTone) : "amber";
}

function asLink(v: unknown): BannerLink {
  if (!v || typeof v !== "object") return { kind: "none" };
  const o = v as Record<string, unknown>;
  if (o.kind === "url" && str(o.href).trim()) {
    return { kind: "url", label: str(o.label).trim() || str(o.href).trim(), href: str(o.href).trim() };
  }
  if (o.kind === "contact") {
    return { kind: "contact", label: str(o.label).trim() || "Nous écrire", subject: str(o.subject).trim() };
  }
  return { kind: "none" };
}

/** Valide / normalise une config de bandeau brute (avec replis sûrs). */
export function readBannerConfig(raw: unknown): BannerConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    enabled: o.enabled !== false,
    id: str(o.id).trim() || "banner",
    emoji: str(o.emoji).trim(),
    title: str(o.title).trim(),
    message: str(o.message),
    tone: asTone(o.tone),
    dismissible: o.dismissible !== false,
    link: asLink(o.link),
  };
}
