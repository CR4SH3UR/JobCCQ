# JobCCQ — Application mobile

Application **Expo (React Native, TypeScript)** pour JobCCQ, l'agrégateur d'offres d'emploi
Québec/Canada. Trois écrans : **Emplois**, **Qui recrute** et **Sources**, consommant l'API
Fastify du dossier [`apps/api`](../api).

Ce dossier est **autonome** : il n'importe pas le package `@jobccq/shared` du monorepo (les
types et libellés nécessaires sont recopiés dans `src/shared.ts`) afin d'éviter tout souci de
résolution de module avec Metro en dehors d'un workspace npm classique.

## Prérequis

- Node.js ≥ 20
- L'API JobCCQ démarrée quelque part (voir [`apps/api`](../api)) — par défaut sur `:4000`.
- Pour tester sur un téléphone physique : l'app [Expo Go](https://expo.dev/go) (Android/iOS),
  et le téléphone sur le **même réseau Wi-Fi** que la machine qui héberge l'API.

## Installation

```bash
cd apps/mobile
npm install
```

(Depuis la racine du monorepo, tu peux aussi lancer `npm run start:mobile`, qui appelle
`npm run start --prefix apps/mobile` — pense simplement à avoir fait `npm install` dans ce
dossier au préalable.)

## Configuration — `EXPO_PUBLIC_API_URL`

L'app lit l'URL de l'API dans la variable d'environnement `EXPO_PUBLIC_API_URL` (préfixe
`EXPO_PUBLIC_` obligatoire pour qu'Expo l'expose au code client). Sans cette variable, elle
utilise `http://localhost:4000` par défaut.

```bash
cp .env.example .env
# puis édite .env si besoin
```

```
EXPO_PUBLIC_API_URL=http://localhost:4000
```

### ⚠️ Important : test sur un téléphone physique

Sur un **simulateur/émulateur** lancé sur la même machine que l'API, `localhost` fonctionne
généralement tel quel (Android peut nécessiter `http://10.0.2.2:4000`).

Mais sur un **vrai téléphone** (via Expo Go ou un build de dev), `localhost` désigne le
téléphone lui-même — pas l'ordinateur qui fait tourner l'API. Il faut donc remplacer
`localhost` par l'**adresse IP locale (LAN)** de la machine qui héberge le back-end, par
exemple :

```
EXPO_PUBLIC_API_URL=http://192.168.1.23:4000
```

Pour trouver cette adresse :

- macOS/Linux : `ipconfig getifaddr en0` (Wi-Fi) ou `hostname -I`
- Windows : `ipconfig` (champ « Adresse IPv4 »)

Assure-toi aussi que :
- le téléphone et l'ordinateur sont sur le **même réseau Wi-Fi** ;
- le pare-feu de la machine autorise les connexions entrantes sur le port `4000` ;
- l'API écoute bien sur `0.0.0.0` (pas seulement `127.0.0.1`) pour accepter les connexions
  venant d'un autre appareil du réseau.

Si l'app affiche « Impossible de joindre l'API », c'est très généralement l'une de ces trois
causes.

## Lancement

```bash
npx expo start
```

Puis, dans le terminal Expo :
- scanne le QR code avec l'app **Expo Go** (Android) ou l'appareil photo (iOS) ;
- ou appuie sur `a` (émulateur Android), `i` (simulateur iOS), `w` (navigateur web).

Scripts disponibles (`package.json`) :

| Script            | Description                              |
| ----------------- | ----------------------------------------- |
| `npm start`        | Démarre le serveur de développement Expo |
| `npm run android`  | Démarre et ouvre sur un émulateur Android |
| `npm run ios`      | Démarre et ouvre sur un simulateur iOS    |
| `npm run web`      | Démarre la version web (Metro → navigateur) |
| `npm run typecheck`| Vérifie les types TypeScript (`tsc --noEmit`) |

## Structure du projet

```
apps/mobile/
├── app/                      # Écrans (routing par fichiers, expo-router)
│   ├── _layout.tsx           # Navigation par onglets (Emplois / Qui recrute / Sources)
│   ├── index.tsx             # Écran Emplois (recherche, filtres, tri, liste infinie)
│   ├── entreprises.tsx       # Écran Qui recrute
│   └── sources.tsx           # Écran Sources
├── src/
│   ├── shared.ts             # Types + taxonomie FR recopiés de packages/shared
│   ├── api.ts                # Appels à l'API (searchJobs, searchCompanies, getSources, getStats)
│   ├── format.ts             # Formatage (salaire, date relative, initiales)
│   ├── hooks.ts               # Hooks utilitaires (debounce)
│   ├── theme.ts               # Couleurs, espacements, styles communs
│   └── components/
│       ├── Badge.tsx
│       ├── JobCard.tsx
│       ├── CompanyCard.tsx
│       └── SourceCard.tsx
├── app.json                  # Config Expo (nom, slug, scheme, plugin expo-router...)
├── babel.config.js
├── metro.config.js
├── tsconfig.json              # strict + alias @/* → src/*
└── .env.example
```

## Écrans

- **Emplois** (`app/index.tsx`) — recherche plein texte débouncée, puces de catégories
  (filtre multi-sélection), sélecteur de tri (récent / pertinence / salaire ↑↓ / entreprise),
  liste à défilement infini (20 offres par page) avec pull-to-refresh. Toucher une offre ouvre
  l'annonce originale dans le navigateur du téléphone.
- **Qui recrute** (`app/entreprises.tsx`) — recherche d'entreprise, liste des entreprises qui
  recrutent avec leur nombre de postes ouverts et leurs principales catégories/régions.
- **Sources** (`app/sources.tsx`) — répertoire des sites d'emploi surveillés par JobCCQ, classés
  en « Sources connectées » et « Sites répertoriés (à connecter) », avec badges région, méthode
  de collecte, statut et volume d'offres.

## Notes techniques

- **Aucune dépendance UI externe** : tous les styles utilisent `StyleSheet` de React Native.
- L'app **ne dépend pas** de `@jobccq/shared` : voir `src/shared.ts`, qui recopie fidèlement les
  types et tables de libellés (id → libellé FR) de `packages/shared/src/{types,taxonomy,sources}.ts`.
  Si la taxonomie du back-end évolue, reporte les changements ici.
- La sérialisation des paramètres de requête (`src/api.ts`) reproduit exactement celle de
  `apps/web/src/lib/data.ts` : les filtres tableaux (`categories`, `regions`, …) sont joints en
  CSV (ex. `categories=ti,genie`).
- Ce dossier n'est **pas** un workspace npm du monorepo racine (volontairement, pour rester
  isolé) : il a son propre `node_modules` après `npm install`.
