/**
 * Glose FR↔EN des intitulés (métiers courants). Pas une traduction neural :
 * on substitue les termes connus et on marque « traduit automatiquement ».
 */
const PAIRS: readonly [string, string][] = [
  ["charpentier-menuisier", "carpenter-joiner"],
  ["charpentier", "carpenter"],
  ["menuisier", "joiner"],
  ["électricien", "electrician"],
  ["electricien", "electrician"],
  ["plombier", "plumber"],
  ["manœuvre", "labourer"],
  ["manoeuvre", "labourer"],
  ["journalier", "labourer"],
  ["peintre", "painter"],
  ["soudeur", "welder"],
  ["maçon", "mason"],
  ["macon", "mason"],
  ["briqueteur", "bricklayer"],
  ["couvreur", "roofer"],
  ["grutier", "crane operator"],
  ["estimateur", "estimator"],
  ["contremaître", "foreman"],
  ["contremaitre", "foreman"],
  ["plâtrier", "plasterer"],
  ["ferblantier", "sheet metal worker"],
  ["opérateur", "operator"],
  ["operateur", "operator"],
  ["chantier", "jobsite"],
  ["construction", "construction"],
  ["temps plein", "full-time"],
  ["temps partiel", "part-time"],
];

export function looksEnglish(text: string): boolean {
  const t = text.toLowerCase();
  const en = (t.match(/\b(the|and|with|for|job|site|worker|operator)\b/g) ?? []).length;
  const fr = (t.match(/\b(le|la|les|des|pour|avec|chantier|poste)\b/g) ?? []).length;
  return en > fr;
}

/** Titre glosé vers l'anglais (ou l'original s'il l'est déjà). */
export function glossTitleToEn(title: string): { text: string; changed: boolean } {
  if (looksEnglish(title)) return { text: title, changed: false };
  let out = title;
  for (const [fr, en] of PAIRS) {
    out = out.replace(new RegExp(fr, "gi"), en);
  }
  return { text: out, changed: out.toLowerCase() !== title.toLowerCase() };
}
