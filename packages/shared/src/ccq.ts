/**
 * Métiers reconnus par la **CCQ** (Commission de la construction du Québec) —
 * les métiers des conventions collectives de l'industrie de la construction.
 *
 * Détection best-effort par mots-clés sur l'intitulé, tolérante aux variantes
 * (apprenti/aide, féminin, accents, ligatures). Sert au filtre « Métiers CCQ »
 * et au badge indicatif. Ce n'est pas un statut officiel : c'est une aide au
 * tri, pas une certification.
 */
export interface CcqTrade {
  readonly id: string;
  readonly label: string;
  readonly re: RegExp;
}

export const CCQ_TRADES: readonly CcqTrade[] = [
  { id: "briqueteur-macon", label: "Briqueteur-maçon", re: /briqueteur|\bma[çc]on(?:ne)?\b/i },
  { id: "calorifugeur", label: "Calorifugeur", re: /calorifugeur/i },
  { id: "carreleur", label: "Carreleur", re: /carreleur/i },
  { id: "charpentier-menuisier", label: "Charpentier-menuisier", re: /charpentier|menuisier/i },
  { id: "chaudronnier", label: "Chaudronnier", re: /chaudronnier/i },
  { id: "cimentier-applicateur", label: "Cimentier-applicateur", re: /cimentier/i },
  { id: "couvreur", label: "Couvreur", re: /couvreur/i },
  { id: "electricien", label: "Électricien", re: /[ée]lectricien/i },
  { id: "ferblantier", label: "Ferblantier", re: /ferblantier/i },
  { id: "ferrailleur", label: "Ferrailleur", re: /ferrailleur|poseur d['’]?armature|armature de b[ée]ton/i },
  { id: "frigoriste", label: "Frigoriste", re: /frigoriste/i },
  { id: "grutier", label: "Grutier", re: /grutier|op[ée]rateur de grue/i },
  // Spécialisé AVANT manœuvre : `ccqTradeOf` prend le premier match.
  { id: "manoeuvre-specialise", label: "Manœuvre spécialisé", re: /manoeuvre[\s-]+sp[ée]cialis/i },
  { id: "manoeuvre", label: "Manœuvre", re: /\bmanoeuvre/i },
  { id: "mecanicien-ascenseur", label: "Mécanicien d'ascenseur", re: /m[ée]canicien(?:ne)?\s+d['’]?ascenseur/i },
  { id: "mecanicien-protection-incendie", label: "Mécanicien en protection-incendie", re: /protection[-\s]?incendie|gicleur/i },
  { id: "mecanicien-chantier", label: "Mécanicien industriel de chantier", re: /m[ée]canicien(?:ne)?\s+(?:industriel(?:le)?\s+)?de\s+chantier|millwright/i },
  { id: "monteur-acier", label: "Monteur d'acier de structure", re: /monteur.?assembleur|monteur\s+d['’]?acier|monteur\s+de\s+structure|structure\s+d['’]?acier/i },
  { id: "monteur-vitrier", label: "Monteur-mécanicien vitrier", re: /vitrier|monteur.?m[ée]canicien/i },
  { id: "operateur-equipement-lourd", label: "Opérateur d'équipement lourd", re: /op[ée]rateur.{0,18}(?:pelle|[ée]quipement lourd|machinerie lourde|excavatrice|niveleuse|bouteur|chargeuse)/i },
  { id: "peintre", label: "Peintre", re: /\bpeintre\b/i },
  { id: "platrier", label: "Plâtrier", re: /pl[âa]trier|tireur de joints/i },
  { id: "plombier", label: "Plombier", re: /plombier/i },
  { id: "poseur-revetements-souples", label: "Poseur de revêtements souples", re: /rev[êe]tements?\s+souples|poseur de (?:planchers?|couvre-?planchers?)/i },
  { id: "poseur-systemes-interieurs", label: "Poseur de systèmes intérieurs", re: /syst[èe]mes?\s+int[ée]rieurs|poseur de gypse|gypseur/i },
  { id: "serrurier-batiment", label: "Serrurier de bâtiment", re: /serrurier de b[âa]timent|m[ée]tallier/i },
  { id: "tuyauteur", label: "Tuyauteur", re: /tuyauteur/i },
  { id: "soudeur", label: "Soudeur", re: /soudeur(?:-?monteur)?|soudeuse/i },
];

/** Métier CCQ correspondant à un intitulé, s'il y en a un. */
export function ccqTradeOf(title?: string | null): CcqTrade | undefined {
  if (!title) return undefined;
  const t = title.replace(/œ/gi, "oe").replace(/æ/gi, "ae");
  return CCQ_TRADES.find((tr) => tr.re.test(t));
}

/** L'intitulé correspond-il à un métier reconnu CCQ ? */
export function isCcqTrade(title?: string | null): boolean {
  return ccqTradeOf(title) !== undefined;
}

/** Libellé du métier CCQ (pour un badge), s'il y en a un. */
export function ccqTradeLabel(title?: string | null): string | undefined {
  return ccqTradeOf(title)?.label;
}

const TRADE_BY_ID = new Map(CCQ_TRADES.map((t) => [t.id, t]));

/** Métier CCQ par identifiant stable (profil, URL `trades=`). */
export function ccqTradeById(id: string): CcqTrade | undefined {
  return TRADE_BY_ID.get(id);
}
