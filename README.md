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
> anti-robot type Cloudflare) et demanderaient un rendu headless. **CCQ** :
> le portail carrières public (`carriere.ccq.org`) est branché ; le Carnet
> référence construction (ex-Carrefour) reste derrière un compte, non importé.

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

Sources branchées (portails carrières d'employeurs de la construction) : **Pomerleau** (Avature), **EBC** (RSS WordPress), **Les Excavations Lafontaine** (Zoho Recruit), **Atwill-Morin** (BambooHR), **Hamel Construction** (Wix) et **LEQEL** (liens HTML). **CCQ** : offres publiques du portail carrières SuccessFactors.

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
| `GET` | `/api/jobs.rss` | Flux RSS de la recherche (mêmes filtres, 50 offres) |
| `GET` | `/api/jobs/:id` | Détail d'une offre |
| `GET` | `/api/companies` | Entreprises qui recrutent (agrégées) |
| `GET` | `/api/sources` | Répertoire des sources + volumes |
| `GET` | `/api/stats` | Statistiques globales |
| `GET` | `/api/meta` | Taxonomies (pour construire l'UI) |
| `POST` | `/api/scrape` | Déclenche un scraping |

Filtres de `/api/jobs` : `q`, `company`, `regions`, `cities`, `categories`, `employmentTypes`, `remote`, `sources`, `languages`, `salaryMin`, `postedWithinDays`, `sort`, `page`, `pageSize`, `trades`, `shifts`, `near`, `radiusKm` (les tableaux sont séparés par des virgules).

---

## Déploiement sur GitHub Pages

Le site peut être publié en **100 % statique** : la logique de filtrage tourne
dans le navigateur à partir d'un instantané `jobs.json`, sans back-end. Si les
secrets `TURSO_DATABASE_URL` et `TURSO_AUTH_TOKEN` sont configurés dans GitHub
Actions, cet instantané est régénéré depuis Turso au moment du déploiement ; sinon
le build utilise les fichiers versionnés.

Configuration unique : dans le dépôt, **Settings → Pages → Source :
« Deploy from a branch »**, branche **`gh-pages`**, dossier **`/ (root)`**.

Ensuite, à chaque push sur `main`, après un scrape réussi, ou via déclenchement
manuel, le workflow `.github/workflows/deploy-pages.yml` :
1. si Turso est configuré, synchronise/exporte les employeurs et génère
   l'instantané depuis la base ;
2. sinon, utilise l'instantané versionné ou le génère s'il est absent ;
3. découpe `jobs.json` par région (manifeste + shards, idée 120) ;
4. construit le site en mode export (`BUILD_STATIC=1`) ;
5. déploie sur `https://<utilisateur>.github.io/jobccq/`.

Pour régénérer l'instantané localement à partir de la vraie base (après un
scraping) : `npm run -w @jobccq/api export:static -- --from-db`.

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
| `npm run profile:queries -w @jobccq/api` | EXPLAIN des filtres fréquents (idée 119) |
| `npm run split:jobs -w @jobccq/api` | Manifeste + shards région (idée 120) |
| `npm run cost:watch -w @jobccq/api` | Budgets instantané / Turso / Workers (idée 121) |

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
- [x] Ajouter d'autres entrepreneurs (Broccolini, Kiewit, Eurovia, Construction Demathieu & Bard…)
- [x] Brancher le Carrefour construction de la CCQ (ccq.org)
- [x] Planification du scraping (cron) + déduplication inter-sources plus fine
- [x] Alertes courriel (Resend), push Expo et ntfy
- [x] Comptes utilisateurs, offres sauvegardées, recherches enregistrées

## Licence

MIT — voir [LICENSE](./LICENSE). Les offres agrégées appartiennent à leurs éditeurs respectifs.

## Idées d'évolution (125)

Backlog d'idées d'ajout, classées par thème — **les mêmes axes que le produit actuel** (taxonomie QC, répertoire de sources, comptes Supabase, favoris/candidatures/alertes, panel admin, enrichissement RBQ, mode Turso live + export statique). Coche une case quand la fonctionnalité est livrée.

### 🔎 Recherche & découverte

- [x] 1. Recherche géographique par rayon (« à moins de X km de mon code postal ») en plus des 17 régions
- [x] 2. Carte interactive des offres (Leaflet/MapLibre) par région/ville
- [x] 3. Autocomplétion dans la barre de recherche (métiers, entreprises, villes)
- [x] 4. Correction de fautes de frappe + synonymes de métiers (« charpentier » ↔ « menuisier »)
- [x] 5. Filtre « nouveautés » (offres ajoutées depuis ma dernière visite)
- [x] 6. Tri par distance (en plus de pertinence / date / salaire)
- [x] 7. Recherches enregistrées (combinaison de filtres nommée — dans ce navigateur)
- [x] 8. URL de recherche partageables (filtres encodés dans l'URL)
- [x] 9. Pages de résultats préconstruites SEO (`/emplois/region/monteregie`, `/emplois/metier/electricien`)
- [x] 10. Comparateur d'offres (2-3 offres côte à côte : salaire, région, type)
- [x] 51. Filtre « salaire renseigné uniquement » (s'appuie sur le filtre salaire déjà là)
- [x] 52. « Offres similaires » sur la fiche (même métier / région / employeur)
- [x] 53. Filtre quart de travail (jour / soir / nuit) quand la description le dit

### 🧾 Qualité & enrichissement des offres

- [x] 11. Normalisation des salaires (fourchette horaire **et** annuelle pour comparer)
- [x] 12. Grille CCQ : taux horaire officiel du métier/région affiché à côté de l'offre
- [x] 13. Détection de doublons inter-sources (fusion + badge « aussi sur X »)
- [x] 14. Extraction des exigences (carte de compétence, ASP Construction, permis classe 1/3…)
- [x] 15. Score de complétude d'une offre (salaire ? lieu ? description ?)
- [x] 16. Résumé automatique de la description (2-3 puces)
- [x] 17. Traduction FR↔EN des offres unilingues (libellé « traduit automatiquement »)
- [x] 18. Détection d'offres expirées (vérif du lien : 404/redirection → « peut-être pourvue »)
- [x] 19. Ancienneté visible et cohérente partout (« il y a 2 j »)
- [x] 20. Historique d'une offre (salaire modifié, réactivée…)
- [x] 54. Extraire contacts RH publics (courriel / téléphone) dans la fiche
- [x] 55. Extraire avantages (REER, assurances, camion fourni) à côté des exigences
- [x] 56. Flag admin « hors construction » → masquée du site public

### 🏢 Entreprises / employeurs

- [x] 21. Fiche employeur enrichie (logo, RBQ, nb d'offres actives, régions, métiers, lien carrières)
- [x] 22. Suivre une entreprise + alerte quand elle publie
- [x] 23. Classement « qui recrute le plus » par région et par métier
- [x] 24. Badge « vérifié » exposé côté site (champ `verified` de l'admin)
- [x] 25. Lien licence RBQ vers le registre public (recherche de licence)
- [x] 26. Employeurs similaires sur une fiche (même région/secteur)
- [x] 27. Historique de recrutement d'un employeur (mini-graphe dans le temps)
- [x] 57. Page « qui recrute près de chez moi » (code postal → même index villes/régions)
- [x] 58. Fusion manuelle de deux fiches employeur (doublons discovered)

### 🔔 Alertes & notifications

- [x] 28. Alertes courriel réelles (digest quotidien/hebdo d'une recherche enregistrée)
- [x] 29. Notifications push mobiles (Expo push) sur nouvelles offres
- [x] 30. Flux RSS des offres (`/emplois.rss` sur le site statique, `/api/jobs.rss` + bouton RSS de la recherche)
- [x] 31. Webhook Discord/Slack / ntfy pour une recherche
- [x] 32. Réglages de fréquence & silence par alerte (instantané / quotidien / hebdo / pause)
- [x] 59. Alerte admin (courriel/Slack) si une grosse source tombe à 0 offre
- [x] 60. Webhook « scrape terminé » (même canal que les webhooks de recherche)
- [ ] 103. Notifications SMS optionnelles pour les alertes critiques

### 👤 Compte & candidatures

- [x] 33. Statuts de candidature (à postuler / postulé / entrevue / refusé / accepté)
- [x] 34. Notes & rappels par candidature (relancer dans N jours)
- [x] 35. Export CSV des favoris et candidatures
- [x] 36. Profil métier (mes métiers/régions → accueil personnalisé)
- [x] 37. Onboarding rapide (métier, région, mobilité → filtres pré-remplis)
- [x] 61. Marquer « déjà postulé » depuis la fiche (compte existant)
- [x] 62. Score d'adéquation offre ↔ profil (métiers / régions du compte)
- [x] 102. Rappels d'échéance en invitation calendrier (`.ics` / Google Calendar)
- [ ] 104. Date limite d'offre extraite + tri « ferme bientôt »
- [ ] 105. Modèles de courriel de relance générés selon le statut de candidature
- [x] 106. Reprise « là où j'en étais » (mémo local des clics « Postuler »)

### 🕷️ Scraping, sources & pipeline

- [x] 38. Rendu headless (Playwright) pour les sites protégés (Cloudflare)
- [x] 39. Planification cron du scraping + backoff par source
- [x] 40. Dashboard de santé des scrapers (sources en échec depuis N jours + alerte)
- [x] 41. Nouveaux helpers ATS : Greenhouse, Lever, Recruitee, SmartRecruiters, Teamtailor
- [x] 42. Import CCQ « Carrefour construction » (ccq.org)
- [x] 43. Découverte semi-auto d'employeurs à partir du registre RBQ
- [x] 44. Tests de non-régression par fixtures HTML (alerte si un parseur casse)
- [x] 63. Preview parseur sans écrire en base (admin, `parseList` local ou JSON-LD/RSS via Supabase)
- [x] 64. Enregistrement d'une fixture HTML depuis l'admin (pour le 44, API locale ou Supabase)
- [x] 65. Retry ciblé des sources en erreur (un bouton, même workflow scrape)
- [x] 66. Playwright à la demande pour une source JS (complément du 38)

### 🛠️ Admin & données

- [x] 45. Journal d'audit des actions admin (qui a modifié quoi, quand — ce navigateur)
- [x] 46. Diff avant publication des changements `discovered.json`
- [x] 47. Édition en masse (activer/désactiver, changer de méthode pour N employeurs)
- [x] 67. Diff des offres après scrape (`+` ajoutée / `~` modifiée / `-` retirée) dans le panel
- [x] 68. Tableau de bord admin (KPIs, top sources, activité + diffs)
- [x] 69. Module Offres (recherche, édition, suppression, export CSV)
- [x] 70. Import CSV d'employeurs (même format que l'export)
- [x] 71. Tester une URL carrières (probe HTTP) + notes internes + copier id/URLs
- [x] 72. Rollback d'un scrape (remettre les offres d'avant le run)
- [x] 73. Stats clics « Postuler » par offre / source (site public → admin)

### 📱 Mobile & plateforme

- [x] 48. Parité mobile (détail d'offre + favoris ; alertes/compte sur le site)
- [x] 74. Mode hors-ligne : dernières offres en cache (même snapshot que le site statique)

### 📈 SEO, perf & accessibilité

- [x] 49. JSON-LD `JobPosting` sur chaque fiche (Google for Jobs) + sitemap dynamique
- [x] 50. i18n EN de l'interface (bascule FR/EN)
- [x] 75. Widget « nos offres » à coller sur le site d'un employeur du répertoire
- [ ] 107. Langue supplémentaire ES (travailleurs immigrants) + architecture i18n extensible
- [ ] 108. Mode lecture facile / dyslexie (police, espacement, contraste renforcé)
- [ ] 109. Audit a11y automatisé en CI (axe-core) + budget d'accessibilité
- [ ] 110. Lecture audio d'une offre (synthèse vocale) sur mobile
- [ ] 111. Réécriture « langage clair » d'une description dense (LLM)
- [x] 118. Logos employeurs : favicon du site (repli) + proxy Weserv (WebP, cache)
- [x] 119. Index DB & requêtes profilées (EXPLAIN) pour les filtres fréquents (Turso/SQLite)
- [x] 120. `jobs.json` par région + delta incrémental (ne recharger que ce qui change)
- [x] 121. Surveillance des coûts (Turso / workers / Pages) + alerte de dépassement

### 🤖 IA & recommandation

- [x] 76. Recherche sémantique (ontologie des métiers de la construction — « poseur de gypse » ↔ « finisseur intérieur ») + mots-outils ignorés dans les requêtes-phrases
- [x] 77. Recommandations « offres pour toi » à partir des favoris/candidatures (filtrage collaboratif simple)
- [ ] 78. Appariement CV → offres : téléverser un CV, extraire métiers/compétences, classer les offres
- [ ] 79. Assistant conversationnel « trouve-moi un emploi » (langage naturel → filtres) via l'API Claude
- [ ] 80. Génération d'une lettre de présentation adaptée à l'offre (brouillon éditable)
- [ ] 81. Auto-catégorisation LLM des offres ambiguës quand la taxonomie par règles échoue (revue admin)

### 📊 Marché du travail & données ouvertes

- [x] 82. Tableau de bord public « marché de la construction QC » (`/marche` : évolution des offres, répartition région/métier)
- [x] 83. Guide salarial par métier/région (médianes observées + grille CCQ) — page SEO à forte valeur
- [x] 84. Baromètre de tension par métier sur `/marche` (offres + ratio offres/1000 travailleurs via table effectifs CCQ éditable)
- [ ] 85. API publique documentée (OpenAPI) + export data ouverte (CSV/JSON)
- [x] 86. Rapport hebdo automatisé (« X nouvelles offres, top employeurs ») publié en page/artefact

### 🏗️ Côté employeur (comptes)

- [x] 87. Comptes employeurs : réclamer sa fiche, corriger les infos, ajouter logo/description
- [x] 88. Publication directe d'une offre par un employeur (modérée), en plus du scraping
- [x] 89. Tableau de bord employeur (vues + clics « postuler » sur ses offres)
- [ ] 90. Badge « répond vite » / délai de réponse moyen (si candidatures suivies)
- [ ] 91. Vérification d'identité employeur (RBQ + domaine courriel) → badge de confiance renforcé

### 🛡️ Confiance, intégrité & conformité

- [ ] 92. Détection d'offres frauduleuses (salaire aberrant, courriel gratuit, « paiement à l'avance »)
- [x] 93. Signalement d'une offre par les utilisateurs (expirée / trompeuse / doublon) + file de modération
- [ ] 94. Détection d'employeurs fantômes (aucune licence RBQ + aucune présence web)
- [ ] 95. Journal de conformité scraping (respect `robots.txt`, throttling, ToS) consultable par source
- [ ] 96. Politique de rétention & anonymisation (Loi 25 QC) + purge automatique

### 💬 Communauté & contenu

- [ ] 97. Avis/évaluations d'employeurs modérés (Glassdoor allégé)
- [ ] 98. Q&R par métier (« comment devenir grutier au QC ? ») — contenu SEO evergreen
- [ ] 99. Guides carrière par métier (parcours, carte de compétence, apprentissage CCQ)
- [ ] 100. Pages « ville » (offres + employeurs + salaire médian par ville)
- [ ] 101. Témoignages / parcours de travailleurs (contenu éditorial)

### 🔭 Observabilité, fiabilité & DX

- [x] 112. Suivi d'erreurs Sentry (API + web + mobile)
- [ ] 113. Métriques scrapers historisées (taux de succès, durée, volume) + graphes — au-delà de l'alerte « en échec »
- [ ] 114. Tests E2E Playwright du site (recherche, filtres, fiche, favoris)
- [ ] 115. Tests de contrat d'API (schémas Zod partagés ↔ réponses) en CI
- [ ] 116. Alerte de dérive de qualité (chute du score de complétude moyen ou du volume global)
- [ ] 117. Lighthouse CI + suivi de la taille du bundle et de `jobs.json`

### 🔒 Sécurité

- [ ] 122. Rate limiting sur l'API publique + anti-abus du proxy de scraping
- [ ] 123. 2FA / clés d'accès pour la console admin + expiration de session
- [ ] 124. Audit de dépendances (npm audit / Dependabot) + scan de secrets en CI
- [ ] 125. En-têtes de sécurité (CSP, HSTS) + revue des permissions Turso (public en lecture seule)
