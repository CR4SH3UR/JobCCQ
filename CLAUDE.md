# CLAUDE.md — JobCCQ

Mémoire projet pour Claude Code. Voir `README.md` pour la présentation complète.

## Ce qu'est le projet

Agrégateur d'offres d'emploi **construction / génie civil au Québec**. On va
chercher les postes ouverts **directement chez les employeurs** (portails
carrières), on normalise (région, domaine, salaire), et on expose une recherche
+ un répertoire d'entreprises. Site web (Next.js) + app mobile (Expo) partageant
la même API et les mêmes types.

## Monorepo (npm workspaces, TypeScript partout)

```
packages/shared/   @jobccq/shared  — types, taxonomie QC, répertoire de sources,
                                      logique de filtrage/tri partagée (applyQuery)
apps/api/          @jobccq/api     — Fastify + Prisma (SQLite dev / Postgres prod)
                                      framework de scraping (1 source = 1 module)
apps/web/          @jobccq/web     — Next.js 15 (App Router) + Tailwind 4, UI FR
apps/mobile/       @jobccq/mobile  — Expo (React Native)
.github/workflows/                 — scrape, deploy-pages, import-employers, enrich-rbq, notify
```

## Commandes

Depuis la racine, sauf indication contraire :

| But | Commande |
| --- | --- |
| Installer les deps | `npm install` |
| Préparer la base (SQLite) + client Prisma | `npm run -w @jobccq/api setup` |
| Peupler des données de démo | `npm run seed` |
| API en dev | `npm run dev:api` (http://localhost:4000) |
| Site en dev | `npm run dev:web` (http://localhost:3000) |
| Lancer le scraping | `npm run scrape` / `npm run scrape -- <id>` |
| **Typecheck (tous les paquets)** | `npm run typecheck` |
| **Tests d'un fichier** | `node --import tsx --test <chemin>/<nom>.test.ts` |
| **Tests scrapers** | `node --import tsx --test apps/api/src/scrapers/*.test.ts` |
| **Tests logique partagée** | `node --import tsx --test packages/shared/src/*.test.ts` |
| **Tests lib du site** | `node --import tsx --test apps/web/src/lib/*.test.ts` |
| Build (shared + web) | `npm run build` |
| Export statique (GitHub Pages) | `BUILD_STATIC=1 npm run build -w @jobccq/web` |

Les tests utilisent le **runner natif `node:test`** (pas Jest/Vitest) via `tsx`.
Il n'y a pas de script `test` dans les `package.json` — utiliser la commande
`node --import tsx --test …` ci-dessus.

## Conventions

- **Commentaires et libellés en français.** Suivre le ton et la densité du code
  autour.
- **ESM NodeNext** : les imports relatifs portent l'extension `.js` même pour
  des fichiers `.ts` (ex. `import { x } from "./util.js"`).
- **Parseurs purs et testables hors-ligne** : un scraper expose un
  `parseList(html, baseUrl)` pur (aucun réseau), testé avec une fixture HTML.
- **Zod** pour la validation, types partagés dans `@jobccq/shared`.

## Architecture du scraping (important)

- Les employeurs vivent dans **`packages/shared/src/discovered.json`**
  (id, name, homepage, `careersUrl`, `method`, region, rbq, sectors…). Ils sont
  éditables dans la console admin.
- Un scraper est soit **générique** (construit depuis `method` par
  `buildDiscoveredScraper`), soit **sur mesure (bespoke)**.
- Un scraper **bespoke** est :
  1. déclaré dans `CUSTOM_SCRAPER_IDS` (`packages/shared/src/custom-scrapers.ts`),
  2. implémenté dans `apps/api/src/scrapers/<id>.ts` (interface `Scraper`),
  3. enregistré dans l'objet `BESPOKE` de `apps/api/src/scrapers/registry.ts`.
- Helpers réutilisables par plateforme d'ATS/portail (fournir juste l'URL) :
  `makeBambooHrScraper`, `makeZohoRecruitScraper`, `makeWpJobFeedScraper`,
  `makeAvatureScraper`, `makeCareersScraper`, `makeJobillicoEmployerScraper`,
  `makeUltiProScraper`, `makeNjoynScraper`, `makeAtsJsonScraper`…
- Recette complète d'ajout d'un scraper : voir le skill **`add-scraper`**
  (`.claude/skills/add-scraper/SKILL.md`).

## Flux de données (3 modes)

- **API** : le site parle à l'API Fastify (dev local).
- **Statique** : export `jobs.json` + logique de filtrage dans le navigateur
  (déploiement GitHub Pages, 100 % statique). `applyQuery()` partagé tourne côté
  serveur ET côté client.
- **Turso (live)** : la console admin lit/écrit **en direct** la base partagée
  depuis le navigateur (client libSQL web). Après un re-scrape, les compteurs et
  aperçus se rafraîchissent via un polling de la table `ScrapeRun`.

## Git / PR

- Branche de travail : celle indiquée par la tâche. Ne pas pousser ailleurs sans
  accord explicite.
- **Ne pas ouvrir de pull request sauf demande explicite.**
- Fin de message de commit :
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## Pièges connus (env. Claude Code web)

- Les deps ne sont **pas** pré-installées : lancer `npm install` d'abord.
- `npm run typecheck` de l'API échoue tant que le **client Prisma n'est pas
  généré** (`npm run -w @jobccq/api setup`) — erreurs `@prisma/client` alors
  attendues, sans rapport avec une modif. Le typecheck de `@jobccq/web` est
  autonome.
- **ESLint n'est pas configuré** : `npm run lint -w @jobccq/web` (`next lint`)
  ouvre un assistant interactif → ne pas s'en servir comme garde-fou CI. Le
  garde-fou réel est `typecheck` + les tests scrapers.

## Sentry — Tracking d'erreurs (#112)

Sentry est intégré dans l'**API**, la **web**, et l'**app mobile** pour capturer
et tracer les erreurs en production. L'intégration est **optionnelle** : sans
DSN, Sentry est simplement désactivé.

### Configuration

| Plateforme | Variable d'env | Notes |
| --- | --- | --- |
| API (Node.js) | `SENTRY_DSN` | Fastify capture les erreurs via handler |
| Web (Next.js) | `NEXT_PUBLIC_SENTRY_DSN` | Init dans `apps/web/src/sentry.config.ts` |
| Mobile (Expo) | `EXPO_PUBLIC_SENTRY_DSN` | Init dans `apps/mobile/src/sentry.config.ts` |

Chaque plateforme lit son DSN au démarrage. Les trois fonctionnent indépendamment.

### Exemple

```bash
# API avec Sentry
SENTRY_DSN=https://key@org.sentry.io/project npm run dev:api

# Web (Sentry facultatif, le site fonctionne sans)
NEXT_PUBLIC_SENTRY_DSN=https://key@org.sentry.io/project npm run dev:web

# Mobile (même pattern)
EXPO_PUBLIC_SENTRY_DSN=https://key@org.sentry.io/project npm start
```
