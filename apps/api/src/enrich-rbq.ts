/**
 * Enrichissement **RBQ** : renseigne automatiquement le numéro de licence RBQ
 * des employeurs à partir de leur nom, en le recoupant avec le registre public
 * des **licences actives de la Régie du bâtiment du Québec** (Données Québec).
 *
 *   RBQ_CSV=/chemin/rdl01_ExtractionDonneesOuvertes.csv \
 *     TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run enrich:rbq -w @jobccq/api
 *
 * Règles (prudence — un mauvais numéro serait pire que pas de numéro) :
 *  - ne remplit QUE les employeurs dont le champ `rbq` est vide (jamais d'écrasure) ;
 *  - correspondance sur le **nom normalisé** (accents, ponctuation et suffixes
 *    juridiques retirés), contre « Nom de l'intervenant » ET « Autre nom » ;
 *  - n'attribue que si le nom pointe vers **une seule** licence (unique). Si
 *    plusieurs, on tente de départager par la **région**; sinon on saute ;
 *  - ne touche jamais la table `Job`. Idempotent (ré-exécutable sans effet).
 *
 * Le registre se télécharge dans le workflow `enrich-rbq.yml` (Données Québec,
 * jeu « Liste des licences actives de la RBQ »).
 */
import "./env.js";
import { createReadStream } from "node:fs";
import { prisma } from "./db.js";

/** Normalise un nom d'entreprise pour l'appariement (retire accents, ponctuation,
 *  parenthèses, suffixes « - Ville », mentions « usine … » et formes juridiques). */
export function normName(s: string): string {
  let x = (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  x = x.replace(/\([^)]*\)/g, " "); // « (Déneigement Nc) »
  x = x.replace(/\s[-–]\s.*$/, " "); // « … - Laval »
  x = x.replace(/,?\s*usine\b.*$/, " "); // « , Usine McInnis »
  x = x.replace(/['’`.,;:!?"()\/\\]/g, " ").replace(/&/g, " et ");
  x = x.replace(/\b\d{4}-?\d{4}\s+quebec\b/g, " "); // société à numéro
  x = x.replace(
    /\b(inc|incorporee|ltee|ltd|limitee|enr|enregistree|senc|sencrl|sec|cie|compagnie|co|corp|corporation|2000|group|groupe|les|le|la|l|de|du|des|et|and|the)\b/g,
    " ",
  );
  return x.replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

const regNorm = (s?: string | null) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

interface Lic {
  muni: string;
  reg: string;
}

/** Colonnes du CSV RBQ (cf. fiche descriptive Données Québec). */
const COL = { LIC: 0, STATUT: 1, NOM: 14, MUNI: 16, REG: 19, AUTRE: 23 };

/** Parseur CSV en flux, tolérant aux guillemets et virgules/sauts internes. */
async function buildIndex(path: string): Promise<Map<string, Map<string, Lic>>> {
  const idx = new Map<string, Map<string, Lic>>();
  const add = (name: string, lic: string, muni: string, reg: string) => {
    const k = normName(name);
    if (!k || k.length < 3) return;
    let m = idx.get(k);
    if (!m) idx.set(k, (m = new Map()));
    if (!m.has(lic)) m.set(lic, { muni: (muni || "").toLowerCase(), reg: (reg || "").toLowerCase() });
  };
  let field = "";
  let row: string[] = [];
  let inQ = false;
  let header = true;
  const onRow = (r: string[]) => {
    if (header) { header = false; return; }
    if ((r[COL.STATUT] || "").toLowerCase() !== "active") return;
    const lic = (r[COL.LIC] || "").trim();
    if (!/^\d{4}-\d{4}-\d{2}$/.test(lic)) return;
    const muni = r[COL.MUNI] || "", reg = r[COL.REG] || "";
    add(r[COL.NOM] || "", lic, muni, reg);
    const autre = r[COL.AUTRE];
    if (autre) add(autre, lic, muni, reg);
  };
  await new Promise<void>((res, rej) => {
    const stream = createReadStream(path, { encoding: "utf8", highWaterMark: 1 << 20 });
    stream.on("data", (raw: string | Buffer) => {
      const chunk = typeof raw === "string" ? raw : raw.toString("utf8");
      for (let i = 0; i < chunk.length; i++) {
        const c = chunk[i];
        if (inQ) {
          if (c === '"') { if (chunk[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
          else field += c;
        } else if (c === '"') inQ = true;
        else if (c === ",") { row.push(field); field = ""; }
        else if (c === "\n") { row.push(field); field = ""; onRow(row); row = []; }
        else if (c === "\r") { /* ignore */ }
        else field += c;
      }
    });
    stream.on("end", () => { if (field.length || row.length) { row.push(field); onRow(row); } res(); });
    stream.on("error", rej);
  });
  return idx;
}

async function main() {
  if (!process.env.TURSO_DATABASE_URL) {
    console.log("TURSO_DATABASE_URL manquant — enrichissement ignoré.");
    return;
  }
  const csv = process.env.RBQ_CSV;
  if (!csv) {
    console.error("RBQ_CSV manquant (chemin du CSV du registre RBQ).");
    process.exitCode = 1;
    return;
  }
  console.log(`Lecture du registre RBQ : ${csv}`);
  const idx = await buildIndex(csv);
  console.log(`Registre : ${idx.size} noms normalisés distincts.`);

  const employers = await prisma.employer.findMany({
    select: { id: true, name: true, region: true, rbq: true },
  });
  const missing = employers.filter((e) => !e.rbq || !e.rbq.trim());
  console.log(`Employeurs : ${employers.length} (sans RBQ : ${missing.length}).`);

  let assigned = 0, disamb = 0, ambiguous = 0, noMatch = 0;
  const log: string[] = [];
  for (const e of missing) {
    const hit = idx.get(normName(e.name));
    if (!hit || hit.size === 0) { noMatch++; continue; }
    let lic: string | undefined;
    if (hit.size === 1) {
      lic = [...hit.keys()][0];
    } else {
      const reg = regNorm(e.region);
      const cand = [...hit.entries()].filter(
        ([, v]) => reg && v.reg && (v.reg.includes(reg) || reg.includes(v.reg)),
      );
      if (cand.length === 1) { lic = cand[0]![0]; disamb++; }
      else { ambiguous++; continue; }
    }
    await prisma.employer.update({ where: { id: e.id }, data: { rbq: lic } });
    assigned++;
    log.push(`  ${e.id}  ${e.name}  →  ${lic}`);
  }

  console.log(
    `\nRBQ renseignés : ${assigned} (dont ${disamb} départagés par région) ; ` +
      `ambigus sautés : ${ambiguous} ; sans correspondance : ${noMatch}.`,
  );
  if (log.length) console.log("\nAttributions :\n" + log.join("\n"));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Erreur enrich-rbq :", err);
  process.exitCode = 1;
});
