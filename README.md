# JobCCQ

**Agrégateur d'offres d'emploi en construction et génie civil au Québec** — un site web et une app mobile qui vont chercher, directement chez les **employeurs de la construction**, **quels postes sont ouverts et où**, avec une recherche et un tri puissants.

- 🔎 **Recherche & filtres** : par mot-clé, région (les 17 régions du Québec), domaine, type de poste, mode de travail (présentiel / hybride / télétravail), salaire, date, langue et source.
- 🏢 **Qui recrute** : les entrepreneurs qui embauchent, classés par nombre de postes ouverts.
- 🧩 **Répertoire de sources** extensible : chaque portail carrières est une entrée du catalogue ; on branche les scrapers un par un.
- 📱 **Site web (Next.js) + app mobile (Expo)** partageant la même API et les mêmes types.

> État : **scraping live, ciblé construction**. Une douzaine d'employeurs sont
> branchés et ramènent de vraies offres via leur portail carrières, selon la
> plateforme : **Avature** (Pomerleau), **BambooHR** (Atwill-Morin), **Zoho
> Recruit** (Lafontaine, Béluga), **RSS WordPress** (EBC), **page employeur
> Jobillico** (Construction & Pavage Portneuf, Côté et fils), **Wix / WordPress**
> (Hamel, JM Demers, JC Drolet, Lefrançois, LEQEL). Chaque type de portail a un
> scraper réutilisable, donc un nouvel employeur s'ajoute en une ligne de config.
> Quelques sites restent hors de portée d'un simple `fetch` (protection
> anti-robot type Cloudflare) et demanderaient un rendu headless.

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

## Idées d'évolution (50)

Backlog d'idées d'ajout, classées par thème. Coche une case quand la fonctionnalité est livrée. Ces pistes sont **additives** : elles s'appuient sur l'existant (taxonomie QC, répertoire de sources, comptes Supabase, favoris/candidatures/alertes, panel admin, enrichissement RBQ, mode Turso live + export statique).

### 🔎 Recherche & découverte

- [ ] 1. Recherche géographique par rayon (« à moins de X km de mon code postal ») en plus des 17 régions
- [ ] 2. Carte interactive des offres (Leaflet/MapLibre) par région/ville
- [x] 3. Autocomplétion dans la barre de recherche (métiers, entreprises, villes)
- [x] 4. Correction de fautes de frappe + synonymes de métiers (« charpentier » ↔ « menuisier »)
- [ ] 5. Filtre « nouveautés » (offres ajoutées depuis ma dernière visite)
- [ ] 6. Tri par distance (en plus de pertinence / date / salaire)
- [ ] 7. Recherches enregistrées (combinaison de filtres nommée — base des alertes)
- [ ] 8. URL de recherche partageables (filtres encodés dans l'URL)
- [ ] 9. Pages de résultats préconstruites SEO (`/emplois/region/monteregie`, `/emplois/metier/electricien`)
- [ ] 10. Comparateur d'offres (2-3 offres côte à côte : salaire, région, type)

### 🧾 Qualité & enrichissement des offres

- [ ] 11. Normalisation des salaires (fourchette horaire **et** annuelle pour comparer)
- [ ] 12. Grille CCQ : taux horaire officiel du métier/région affiché à côté de l'offre
- [ ] 13. Détection de doublons inter-sources (fusion + badge « aussi sur X »)
- [ ] 14. Extraction des exigences (carte de compétence, ASP Construction, permis classe 1/3…)
- [ ] 15. Score de complétude d'une offre (salaire ? lieu ? description ?)
- [ ] 16. Résumé automatique de la description (2-3 puces)
- [ ] 17. Traduction FR↔EN des offres unilingues (libellé « traduit automatiquement »)
- [ ] 18. Détection d'offres expirées (vérif du lien : 404/redirection → « peut-être pourvue »)
- [ ] 19. Ancienneté visible et cohérente partout (« il y a 2 j »)
- [ ] 20. Historique d'une offre (salaire modifié, réactivée…)

### 🏢 Entreprises / employeurs

- [ ] 21. Fiche employeur enrichie (logo, RBQ, nb d'offres actives, régions, lien carrières)
- [ ] 22. Suivre une entreprise + alerte quand elle publie
- [ ] 23. Classement « qui recrute le plus » par région et par métier
- [ ] 24. Badge « vérifié » exposé côté site (champ `verified` de l'admin)
- [ ] 25. Statut RBQ live (validité de la licence + lien vers le registre)
- [ ] 26. Employeurs similaires sur une fiche (même région/secteur)
- [ ] 27. Historique de recrutement d'un employeur (mini-graphe dans le temps)

### 🔔 Alertes & notifications

- [ ] 28. Alertes courriel réelles (digest quotidien/hebdo d'une recherche enregistrée)
- [ ] 29. Notifications push mobiles (Expo push) sur nouvelles offres
- [ ] 30. Flux RSS/Atom par recherche (`/emplois.rss?regions=…&q=…`)
- [ ] 31. Webhook Discord/Slack pour une recherche
- [ ] 32. Réglages de fréquence & silence par alerte (instantané / quotidien / hebdo / pause)

### 👤 Compte & candidatures

- [ ] 33. Statuts de candidature (à postuler / postulé / entrevue / refusé / accepté)
- [ ] 34. Notes & rappels par candidature (relancer dans N jours)
- [ ] 35. Export CSV/PDF des favoris et candidatures
- [ ] 36. Profil métier (mes métiers/régions → accueil personnalisé)
- [ ] 37. Onboarding rapide (métier, région, mobilité → filtres pré-remplis)

### 🕷️ Scraping, sources & pipeline

- [ ] 38. Rendu headless (Playwright) pour les sites protégés (Cloudflare)
- [ ] 39. Planification cron du scraping + backoff par source
- [ ] 40. Dashboard de santé des scrapers (sources en échec depuis N jours + alerte)
- [ ] 41. Nouveaux helpers ATS : Greenhouse, Lever, Recruitee, SmartRecruiters, Teamtailor
- [ ] 42. Import CCQ « Carrefour construction » (ccq.org)
- [ ] 43. Découverte semi-auto d'employeurs à partir du registre RBQ
- [ ] 44. Tests de non-régression par fixtures HTML (alerte si un parseur casse)

### 🛠️ Admin & données

- [ ] 45. Journal d'audit des actions admin (qui a modifié quoi, quand)
- [ ] 46. Diff avant publication des changements `discovered.json`
- [ ] 47. Édition en masse (activer/désactiver, changer de méthode pour N employeurs)

### 📱 Mobile & plateforme

- [ ] 48. Parité mobile (détail d'offre, favoris, alertes, compte)

### 📈 SEO, perf & accessibilité

- [ ] 49. JSON-LD `JobPosting` sur chaque fiche (Google for Jobs) + sitemap dynamique
- [ ] 50. Audit accessibilité complet + i18n EN de l'interface (bascule FR/EN)

## Licence

MIT — voir [LICENSE](./LICENSE). Les offres agrégées appartiennent à leurs éditeurs respectifs.
