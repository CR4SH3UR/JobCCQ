# JobCCQ

**Agrégateur d'offres d'emploi en construction et génie civil au Québec** — un site web et une app mobile qui vont chercher, directement chez les **employeurs de la construction**, **quels postes sont ouverts et où**, avec une recherche et un tri puissants.

- 🔎 **Recherche & filtres** : par mot-clé, région (les 17 régions du Québec), domaine, type de poste, mode de travail (présentiel / hybride / télétravail), salaire, date, langue et source.
- 🏢 **Qui recrute** : les entrepreneurs qui embauchent, classés par nombre de postes ouverts.
- 🧩 **Répertoire de sources** extensible : chaque portail carrières est une entrée du catalogue ; on branche les scrapers un par un.
- 📱 **Site web (Next.js) + app mobile (Expo)** partageant la même API et les mêmes types.

> État : **scraping live, ciblé construction**. Six employeurs sont branchés et
> ramènent de vraies offres via leur portail carrières : **Pomerleau** (Avature),
> **EBC** (RSS WordPress), **Les Excavations Lafontaine** (Zoho Recruit),
> **Atwill-Morin** (BambooHR), **Hamel Construction** (Wix) et **LEQEL** (liens
> HTML). Chaque type de portail a un scraper réutilisable, donc un nouvel
> employeur s'ajoute en une ligne de config.

---

## Architecture

Monorepo TypeScript (npm workspaces) :

```
jobccq/
├── packages/
│   └── shared/          @jobccq/shared — types, taxonomie QC, répertoire de sources,
│                        et logique de filtrage/tri partagée (API + web + mobile)
├── apps/
│   ├── api/             @jobccq/api — Fastify + Prisma (SQLite)
│   │                    · framework de scraping (1 source = 1 module)
│   │                    · normalisation (détection région / domaine / salaire)
│   │                    · API REST de recherche, entreprises, sources, stats
│   ├── web/             @jobccq/web — Next.js (App Router) + Tailwind, UI FR
│   │                    · fonctionne avec l'API OU en 100% statique (GitHub Pages)
│   └── mobile/          @jobccq/mobile — Expo (React Native), consomme l'API
└── .github/workflows/   déploiement du site sur GitHub Pages
```

Le **contrat commun** vit dans `packages/shared` : le même modèle `Job` et la même fonction `applyQuery()` (filtrage + tri + facettes) sont utilisés côté serveur **et** côté navigateur. C'est ce qui permet au site de fonctionner sans serveur sur GitHub Pages.

---

## Démarrage rapide

Prérequis : **Node ≥ 20**.

```bash
# 1. Installer les dépendances du monorepo
npm install

# 2. Préparer la base de données (SQLite) et le client Prisma
npm run -w @jobccq/api setup

# 3. Peupler avec les 72 offres de démonstration
npm run seed

# 4. Démarrer l'API (http://localhost:4000)
npm run dev:api

# 5. Dans un autre terminal : démarrer le site (http://localhost:3000)
npm run dev:web
```

Le site est alors utilisable : recherche, filtres, tri, « qui recrute » et répertoire des sources.

### App mobile

```bash
cd apps/mobile
npm install
npx expo start
```

Configure `EXPO_PUBLIC_API_URL` (voir `apps/mobile/.env.example`). Sur un vrai téléphone, remplace `localhost` par l'adresse IP LAN de la machine qui héberge l'API.

---

## Le répertoire de sources

Toutes les sources sont déclarées dans **`packages/shared/src/sources.ts`**. Chaque entrée décrit un site (nom, URL, région, méthode, statut, langue). Statuts :

| Statut | Sens |
| --- | --- |
| `active` | Scraper implémenté et branché |
| `experimental` | Scraper écrit, à valider contre le site réel |
| `planned` | Site répertorié, scraper à écrire |

Sources branchées (portails carrières d'employeurs de la construction) : **Pomerleau** (Avature), **EBC** (RSS WordPress), **Les Excavations Lafontaine** (Zoho Recruit), **Atwill-Morin** (BambooHR), **Hamel Construction** (Wix) et **LEQEL** (liens HTML). Répertorié pour plus tard : **CCQ — Carrefour construction**.

### Ajouter une source

1. Ajoute une entrée dans `packages/shared/src/sources.ts`.
2. Implémente un `Scraper` dans `apps/api/src/scrapers/` (voir ci-dessous).
3. Enregistre-le dans `apps/api/src/scrapers/registry.ts`.

Un scraper implémente une interface simple :

```ts
interface Scraper {
  id: string; // = id de la source
  scrape(params, ctx): Promise<RawJob[]>;
  parseList?(html, baseUrl): RawJob[]; // parseur pur, testable hors-ligne
}
```

Selon la plateforme du portail carrières, un helper réutilisable suffit (il ne reste qu'à fournir l'URL) :

| Plateforme de l'employeur | Helper | Exemple |
| --- | --- | --- |
| BambooHR (ATS) | `makeBambooHrScraper` | Atwill-Morin |
| Zoho Recruit (RSS) | `makeZohoRecruitScraper` | Lafontaine |
| WordPress « job feed » (RSS) | `makeWpJobFeedScraper` | EBC |
| Avature (ATS) | `makeAvatureScraper` | Pomerleau |
| Page carrières Wix / liens HTML | `makeCareersScraper` | Hamel, LEQEL |

### Lancer le scraping

```bash
npm run scrape                      # toutes les sources branchées
npm run scrape -- pomerleau         # une source
```

> ⚠️ **Réseau** : le scraping nécessite un accès sortant aux sites d'emploi. Dans certains environnements (bacs à sable, CI restreinte), l'accès est bloqué — utilise alors les données de démo (`npm run seed`). Le scraping est conçu pour être **poli** (User-Agent identifiable, throttling, retry). Respecte les conditions d'utilisation et le `robots.txt` de chaque site, ainsi que les lois applicables.

---

## API

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/jobs` | Recherche d'offres (filtres, tri, pagination, facettes) |
| `GET` | `/api/jobs/:id` | Détail d'une offre |
| `GET` | `/api/companies` | Entreprises qui recrutent (agrégées) |
| `GET` | `/api/sources` | Répertoire des sources + volumes |
| `GET` | `/api/stats` | Statistiques globales |
| `GET` | `/api/meta` | Taxonomies (pour construire l'UI) |
| `POST` | `/api/scrape` | Déclenche un scraping |

Filtres de `/api/jobs` : `q`, `company`, `regions`, `cities`, `categories`, `employmentTypes`, `remote`, `sources`, `languages`, `salaryMin`, `postedWithinDays`, `sort`, `page`, `pageSize` (les tableaux sont séparés par des virgules).

---

## Déploiement sur GitHub Pages

Le site peut être publié en **100 % statique** : la logique de filtrage tourne dans le navigateur à partir d'un instantané `jobs.json`, sans back-end.

Configuration unique : dans le dépôt, **Settings → Pages → Source : « GitHub Actions »**.

Ensuite, à chaque push sur `main` (ou via déclenchement manuel), le workflow `.github/workflows/deploy-pages.yml` :
1. génère l'instantané (`npm run export:static -w @jobccq/api`) ;
2. construit le site en mode export (`BUILD_STATIC=1`) ;
3. déploie sur `https://<utilisateur>.github.io/jobccq/`.

Pour régénérer l'instantané à partir de la vraie base (après un scraping) : `npm run -w @jobccq/api export:static -- --from-db`.

---

## Scripts utiles (racine)

| Script | Effet |
| --- | --- |
| `npm run dev:api` | API en mode watch |
| `npm run dev:web` | Site en mode dev |
| `npm run seed` | Peuple la base (démo) |
| `npm run scrape` | Lance le scraping |
| `npm run typecheck` | Vérifie le typage de tous les paquets |
| `npm run build` | Build du package partagé + du site |

---

## Pile technique

- **Langage** : TypeScript partout
- **API** : Fastify 5, Prisma 5 (SQLite en dev → PostgreSQL en prod)
- **Scraping** : `fetch` + Cheerio, extraction JSON-LD schema.org
- **Site** : Next.js 15 (App Router), Tailwind CSS 4
- **Mobile** : Expo (React Native), expo-router
- **Validation** : Zod (schémas partagés)

## Feuille de route

- [x] Brancher 6 employeurs de la construction (Pomerleau, EBC, Lafontaine, Atwill-Morin, Hamel, LEQEL)
- [ ] Ajouter d'autres entrepreneurs (Broccolini, Kiewit, Eurovia, Construction Demathieu & Bard…)
- [ ] Brancher le Carrefour construction de la CCQ (ccq.org)
- [ ] Planification du scraping (cron) + déduplication inter-sources plus fine
- [ ] Alertes courriel / notifications push mobiles sur nouvelles offres
- [ ] Comptes utilisateurs, offres sauvegardées, recherches enregistrées

## Licence

MIT — voir [LICENSE](./LICENSE). Les offres agrégées appartiennent à leurs éditeurs respectifs.
