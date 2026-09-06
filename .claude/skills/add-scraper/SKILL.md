---
name: add-scraper
description: Ajouter (ou réparer) un scraper d'employeur dans JobCCQ. Utiliser quand on veut brancher un nouveau portail carrières, écrire un parseur sur mesure pour un employeur, ou corriger un scraper qui ne remonte plus d'offres. Couvre la recette complète : discovered.json → custom-scrapers.ts → module scraper → registry.ts → test fixture.
---

# Ajouter un scraper d'employeur (JobCCQ)

Un employeur = une entrée de `packages/shared/src/discovered.json`. Son scraper
est soit **générique** (construit depuis le champ `method`), soit **sur mesure
(bespoke)** quand le portail a une structure particulière. Ce skill décrit
l'ajout d'un scraper **bespoke** ; pour un portail sur une plateforme connue,
préférer d'abord un **helper** existant.

## Avant de coder : choisir la voie la plus simple

1. **Récupérer la page carrières réelle** et regarder sa structure :
   ```bash
   curl -sSL -A "Mozilla/5.0" "<careersUrl>" -o /tmp/page.html
   ```
2. **Le site expose-t-il du JSON-LD `JobPosting` ?** → scraper générique
   `jsonld`, souvent aucun code à écrire (juste la bonne `method`).
3. **Le portail est-il sur une plateforme connue ?** Réutiliser un helper
   (fournir juste l'URL), au lieu d'un parseur maison :

   | Plateforme | Helper (`apps/api/src/scrapers/…`) |
   | --- | --- |
   | BambooHR | `makeBambooHrScraper` |
   | Zoho Recruit (RSS) | `makeZohoRecruitScraper` |
   | WordPress job feed (RSS) | `makeWpJobFeedScraper` |
   | Avature | `makeAvatureScraper` |
   | UltiPro | `makeUltiProScraper` |
   | Njoyn | `makeNjoynScraper` |
   | Jobillico (page employeur) | `makeJobillicoEmployerScraper` |
   | Page carrières Wix / liens HTML | `makeCareersScraper` / `refineCareers` |
   | ATS JSON générique | `makeAtsJsonScraper` |

   Exemple minimal (Jobillico) :
   ```ts
   import { makeJobillicoEmployerScraper } from "./jobillico-employer.js";
   export const monEmployeurScraper = makeJobillicoEmployerScraper({
     id: "mon-employeur",
     company: "Mon Employeur",
     listUrl: "https://www.jobillico.com/voir-entreprise/…",
   });
   ```
4. **Sinon**, écrire un parseur HTML sur mesure avec Cheerio (étapes ci-dessous).

## Recette complète (scraper bespoke)

Choisir un **`id` stable** (souvent le domaine slugifié, ex. `boreacanada-com`).
Les 5 fichiers à toucher :

### 1. `packages/shared/src/discovered.json`

Ajouter/adapter l'entrée de l'employeur (si absente) :
```json
{
  "id": "mon-employeur-com",
  "name": "Mon Employeur",
  "homepage": "https://mon-employeur.com",
  "careersUrl": "https://mon-employeur.com/carrieres/",
  "method": "html",
  "region": "Montréal",
  "scope": "Employeur — construction",
  "sectors": ["Commercial et institutionnel"]
}
```

### 2. `packages/shared/src/custom-scrapers.ts`

Ajouter l'`id` au tableau `CUSTOM_SCRAPER_IDS` (c'est ce qui marque l'employeur
comme « scraper sur mesure », côté admin et registre).

### 3. `apps/api/src/scrapers/<id>.ts`

Implémenter l'interface `Scraper`. Garder `parseList` **pur** (aucun réseau) et
faire tout le fetch dans `scrape`. Squelette :

```ts
import * as cheerio from "cheerio";
import type { RawJob } from "@jobccq/shared";
import type { Scraper, ScrapeContext, ScrapeParams } from "./types.js";
import { enrichJobsFromDetails } from "./job-details.js";
import { absolute, cleanText } from "./util.js";

const ID = "mon-employeur-com";
const COMPANY = "Mon Employeur";
const CAREERS_URL = "https://mon-employeur.com/carrieres/";

/** Parseur PUR : HTML → offres. Testable hors-ligne avec une fixture. */
export function parseMonEmployeur(html: string, baseUrl = CAREERS_URL): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  $("a.job-card").each((_, el) => {           // ← adapter le sélecteur au site
    const $el = $(el);
    const title = cleanText($el.text());
    const href = ($el.attr("href") ?? "").trim();
    if (!title || !href) return;
    const url = absolute(baseUrl.split("#")[0]!, href);
    if (seen.has(url)) return;
    seen.add(url);
    jobs.push({ sourceId: ID, url, title, company: COMPANY, tags: [] });
  });

  return jobs;
}

export const monEmployeurScraper: Scraper = {
  id: ID,
  parseList: (html, baseUrl) => parseMonEmployeur(html, baseUrl || CAREERS_URL),
  async scrape(_params: ScrapeParams, ctx: ScrapeContext): Promise<RawJob[]> {
    ctx.log(`${ID} — page carrières : ${CAREERS_URL}`);
    let html: string;
    try {
      html = await ctx.fetchHtml(CAREERS_URL);
    } catch (err) {
      ctx.log(`${ID} — échec de récupération : ${(err as Error).message}`);
      return [];
    }
    const jobs = await enrichJobsFromDetails(parseMonEmployeur(html, CAREERS_URL), ctx, {
      listUrl: CAREERS_URL,
    });
    ctx.log(`${ID} — ${jobs.length} poste(s) trouvé(s)`);
    if (jobs.length === 0) ctx.markNoOpenings?.();   // page joignable mais 0 offre
    return jobs;
  },
};
```

Notes :
- Utiliser les helpers de `./util.js` : `absolute`, `cleanText`, `slugify`,
  `parseFrenchDate`, `mapEmploymentType`, `mapSalaryUnit`.
- **Description, salaire et villes** : les remplir dès que la page les expose.
  - Sur la liste (accordéon, carte) : texte du volet + `detailsFromText` /
    `mergeJobDetails` (`./job-details.js`).
  - Fiches distinctes (`/emploi/…`) : après `parseList`, appeler
    `enrichJobsFromDetails` (JSON-LD puis HTML : description complète,
    fourchette salariale, villes).
- Quand une offre n'a pas d'URL propre, fabriquer une ancre stable :
  `` `${baseUrl.split("#")[0]}#${slugify(title)}` ``.
- Appeler `ctx.markNoOpenings?.()` quand la page est joignable mais sans offre
  (permet à la synchro de purger les offres périmées).

### 4. `apps/api/src/scrapers/registry.ts`

- Ajouter l'import (extension `.js`) :
  `import { monEmployeurScraper } from "./mon-employeur-com.js";`
- Ajouter l'entrée dans l'objet `BESPOKE` :
  `"mon-employeur-com": monEmployeurScraper,`

### 5. `apps/api/src/scrapers/<id>.test.ts`

Test avec `node:test` + une **fixture HTML** représentative (idéalement un
extrait réel de la page). Vérifier titres, URLs résolues, et le cas « page vide ».

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMonEmployeur } from "./mon-employeur-com.js";

const FIXTURE = `<html><body>
  <a class="job-card" href="offre-1">Charpentier(ère)</a>
</body></html>`;
const BASE = "https://mon-employeur.com/carrieres/";

describe("parseMonEmployeur", () => {
  it("extrait les offres", () => {
    const jobs = parseMonEmployeur(FIXTURE, BASE);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]!.url, "https://mon-employeur.com/carrieres/offre-1");
    assert.equal(jobs[0]!.company, "Mon Employeur");
  });
  it("renvoie [] si aucune offre", () => {
    assert.deepEqual(parseMonEmployeur("<html></html>", BASE), []);
  });
});
```

## Vérifier

```bash
node --import tsx --test apps/api/src/scrapers/mon-employeur-com.test.ts   # le test
node --import tsx --test apps/api/src/scrapers/*.test.ts                   # non-régression
npm run typecheck -w @jobccq/web    # si l'UI touche discovered.json (types)
```

Et, si l'accès réseau le permet, valider contre la vraie page :
```bash
npm run scrape -- mon-employeur-com
```

## Réparer un scraper qui ne remonte plus rien

En général la structure du site a changé. Marche à suivre :
1. Refetch la page (`curl`), comparer avec les sélecteurs du parseur.
2. Mettre à jour les sélecteurs dans `parseXxx`, garder un **repli** sur
   l'ancienne logique si utile (robustesse).
3. Mettre à jour/ajouter une fixture reflétant la nouvelle structure ; garder un
   test pour l'ancienne en repli.
4. Relancer les tests + valider contre la page réelle.

## À NE PAS faire
- Ne pas mettre de réseau dans `parseList` (doit rester pur/testable).
- Ne pas désactiver ou vider un test pour « faire passer ».
- Ne pas oublier l'un des 5 fichiers (un bespoke non enregistré dans `BESPOKE`
  retombe silencieusement sur le scraper générique).
