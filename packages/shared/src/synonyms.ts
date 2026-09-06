/**
 * Synonymes et termes proches pour les **métiers de la construction**.
 *
 * Une recherche sur un terme d'un groupe fait aussi correspondre les autres
 * (ex. « charpentier » ↔ « menuisier », « manœuvre » ↔ « journalier »,
 * « soudeur » ↔ « welder »). On relie le langage courant au vocabulaire des
 * intitulés d'offres. Volontairement conservateur : on ne regroupe que des
 * métiers réellement équivalents ou des paires courant ↔ officiel, pour éviter
 * d'élargir la recherche à tort.
 */
import { normalizeText } from "./text.js";

export const TRADE_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ["charpentier", "menuisier", "charpentier-menuisier"],
  ["electricien", "electricienne"],
  ["plombier", "tuyauteur"],
  ["manoeuvre", "journalier", "aide-general"],
  ["peintre", "peinture"],
  ["soudeur", "soudeuse", "welder", "soudeur-monteur"],
  ["macon", "briqueteur", "briqueteur-macon"],
  ["couvreur", "toiture", "toitures"],
  ["grutier", "operateur de grue"],
  ["estimateur", "estimatrice", "estimation"],
  ["contremaitre", "chef d'equipe", "surintendant"],
  ["platrier", "tireur de joints", "poseur de gypse", "gypseur"],
  ["ferblantier", "ferblantiere"],
  ["ebeniste", "ebenisterie"],
  ["cimentier", "cimentier-applicateur", "finisseur de beton"],
  ["arpenteur", "geometre"],
  ["mecanicien de chantier", "millwright", "mecanicien industriel"],
  ["operateur d'equipement lourd", "operateur de machinerie", "conducteur d'equipement lourd"],
  ["charge de projet", "chargee de projet", "gestionnaire de projet", "gerant de projet"],
];

/**
 * Index : mot unique normalisé → ensemble des termes équivalents (normalisés).
 * On indexe par chaque mot « significatif » (≥ 3 lettres) de chaque terme, afin
 * qu'une requête d'un seul mot (« grutier ») retrouve les termes multi-mots du
 * groupe (« operateur de grue »).
 */
const SYNONYM_INDEX: Map<string, Set<string>> = (() => {
  const index = new Map<string, Set<string>>();
  for (const group of TRADE_SYNONYM_GROUPS) {
    const terms = group.map(normalizeText);
    const all = new Set(terms);
    for (const term of terms) {
      for (const word of term.split(/\s+/)) {
        if (word.length < 3) continue; // ignore « de », « d' », etc.
        let set = index.get(word);
        if (!set) index.set(word, (set = new Set()));
        for (const t of all) set.add(t);
      }
    }
  }
  return index;
})();

/**
 * Termes équivalents d'un mot (déjà normalisé), **incluant le mot lui-même**.
 * Renvoie `[word]` si aucun synonyme connu. Les termes renvoyés peuvent être
 * des expressions (ex. « operateur de grue ») : on les compare par sous-chaîne
 * sur le texte normalisé de l'offre.
 */
export function expandTerm(normalizedWord: string): string[] {
  const set = SYNONYM_INDEX.get(normalizedWord);
  if (!set) return [normalizedWord];
  return set.has(normalizedWord) ? [...set] : [normalizedWord, ...set];
}

/**
 * **Ontologie des métiers de la construction** : familles de métiers *reliés*
 * (pas strictement équivalents comme les synonymes ci-dessus). Sert la recherche
 * sémantique — une requête retrouve les métiers de la même famille de travail
 * (ex. « poseur de gypse » ↔ « finisseur intérieur », « charpentier » ↔
 * « coffreur »). Volontairement **serrée** : on ne relie que des métiers dont le
 * recoupement est réellement utile en recherche, pour ne pas élargir à tort
 * (« charpentier » ne doit pas ramener « électricien »).
 */
export const TRADE_ONTOLOGY_GROUPS: readonly (readonly string[])[] = [
  // Systèmes intérieurs (gypse, joints, acoustique)
  ["platrier", "tireur de joints", "poseur de gypse", "gypseur", "finisseur interieur", "systemes interieurs"],
  // Charpente & coffrage (bois / structure)
  ["charpentier", "menuisier", "coffreur", "charpente"],
  // Béton & armature
  ["cimentier", "finisseur de beton", "betonnier", "ferrailleur"],
  // Terrassement & excavation (machinerie lourde de génie civil)
  ["operateur d'equipement lourd", "operateur de machinerie", "conducteur d'equipement lourd", "excavation", "terrassement"],
  // Toiture & enveloppe du bâtiment
  ["couvreur", "toiture", "ferblantier", "revetement exterieur"],
  // Électricité
  ["electricien", "cableur", "domotique"],
  // Mécanique du bâtiment (plomberie / CVAC / réfrigération)
  ["plombier", "tuyauteur", "frigoriste", "chauffagiste", "ventilation", "cvac"],
];

/** Index ontologie : mot normalisé → ensemble des termes reliés (même logique que SYNONYM_INDEX). */
const ONTOLOGY_INDEX: Map<string, Set<string>> = (() => {
  const index = new Map<string, Set<string>>();
  for (const group of TRADE_ONTOLOGY_GROUPS) {
    const terms = group.map(normalizeText);
    const all = new Set(terms);
    for (const term of terms) {
      for (const word of term.split(/\s+/)) {
        if (word.length < 3) continue;
        let set = index.get(word);
        if (!set) index.set(word, (set = new Set()));
        for (const t of all) set.add(t);
      }
    }
  }
  return index;
})();

/**
 * Expansion **sémantique** d'un mot (déjà normalisé) : union des synonymes
 * stricts (`expandTerm`) et des métiers reliés de l'ontologie, en incluant
 * toujours le mot lui-même. C'est ce que la recherche utilise pour retrouver un
 * métier proche même quand l'intitulé emploie un autre terme du même domaine.
 */
export function expandSemantic(normalizedWord: string): string[] {
  const out = new Set(expandTerm(normalizedWord));
  const related = ONTOLOGY_INDEX.get(normalizedWord);
  if (related) for (const t of related) out.add(t);
  return [...out];
}
