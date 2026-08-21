# Migration vers Turso (base de données libSQL)

Objectif : remplacer les fichiers JSON versionnés dans git (`discovered.json`,
`jobs.json`) par une **vraie base** partagée, pour supprimer le va-et-vient
git (conflits de merge, onglet périmé qui écrase le RBQ, reconstruction
d'instantané…). Turso = « SQLite dans le cloud » (libSQL) : on garde Prisma et
tout le code existant.

> **Rien ne casse tant que Turso n'est pas configuré.** Sans les variables
> `TURSO_*`, l'app utilise le fichier SQLite local comme avant.

## Phase 1 — la base (ce PR)

- L'adaptateur Prisma libSQL est branché (`apps/api/src/db.ts`) : si
  `TURSO_DATABASE_URL` est défini, le scraping et l'API d'admin écrivent dans
  Turso ; sinon, fichier SQLite local (dev).
- Un modèle **`Employer`** est ajouté au schéma (l'équivalent de
  `discovered.json` en base).
- Un script de migration unique importe l'existant dans Turso.

### 1. Créer la base Turso (gratuit)

Installe le CLI puis crée la base :

```bash
curl -sSfL https://get.tur.so/install.sh | bash   # installe le CLI turso
turso auth signup                                  # compte gratuit
turso db create jobccq                             # crée la base

turso db show --url jobccq                         # -> TURSO_DATABASE_URL (libsql://…)
turso db tokens create jobccq                      # -> TURSO_AUTH_TOKEN
```

### 2. Importer l'existant (une seule fois)

Depuis le dépôt, avec les deux valeurs ci-dessus :

```bash
TURSO_DATABASE_URL="libsql://jobccq-….turso.io" \
TURSO_AUTH_TOKEN="…" \
npm run turso:migrate -w @jobccq/api
```

Crée le schéma + importe les 1766 employeurs (`discovered.json`) et les offres
(`jobs.json`). Ré-exécutable sans risque (idempotent).

### 3. Faire écrire le scraping dans Turso

Ajoute deux secrets GitHub (dépôt → **Settings → Secrets and variables →
Actions**) :

| Secret               | Valeur                             |
| -------------------- | ---------------------------------- |
| `TURSO_DATABASE_URL` | l'URL `libsql://…`                 |
| `TURSO_AUTH_TOKEN`   | le jeton                           |

Le workflow « Scraper les offres » les passe déjà à l'étape de scraping : dès
qu'ils sont présents, le scraping planifié écrit dans Turso.

## Phases suivantes (à venir)

- **Phase 2** — le site public lit les offres et les employeurs depuis Turso
  (jeton **lecture seule**), au lieu des fichiers embarqués → plus besoin de
  recommitter `jobs.json`.
- **Phase 3** — la console d'admin écrit les modifications directement dans
  Turso (jeton lecture/écriture, collé comme l'actuel jeton GitHub) → plus de
  bouton « Publier » qui commit, plus d'écrasement de RBQ.

Une fois Turso en place (étapes 1–3), préviens et on branche les phases 2 et 3.

## Repli / annulation

Retire simplement les secrets `TURSO_*` (ou les variables d'environnement) :
l'app repasse au fichier SQLite local + instantané, sans changement de code.
