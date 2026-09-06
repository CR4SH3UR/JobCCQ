# Comptes + favoris synchronisés — Supabase

Le site est un **export statique** (GitHub Pages, aucun serveur). Supabase fournit
l'**authentification** (lien magique par courriel) et une **base** pour les favoris,
le tout depuis le navigateur. La clé « anon » est **publique** par conception : la
sécurité vient des règles **RLS** (chaque personne ne voit que ses propres favoris).

Tant que les variables ne sont pas configurées, l'app fonctionne en **favoris locaux**
(localStorage) — rien ne casse. Une fois les 4 étapes ci-dessous faites, les comptes
s'activent automatiquement.

## 1. Créer le projet Supabase

1. https://supabase.com → **New project** (note le mot de passe de la base, pas requis ici).
2. **Project Settings → API** : copie **Project URL** et la clé **anon public**.

## 2. Créer la table + les règles RLS

**SQL Editor → New query**, colle ceci et exécute :

```sql
create table if not exists public.favorites (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  job_id     text        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

alter table public.favorites enable row level security;

-- Chacun ne lit / ajoute / retire QUE ses propres favoris.
create policy "read own favorites"   on public.favorites for select using (auth.uid() = user_id);
create policy "insert own favorites" on public.favorites for insert with check (auth.uid() = user_id);
create policy "delete own favorites" on public.favorites for delete using (auth.uid() = user_id);
```

### Table des candidatures (« j'ai postulé »)

Même principe que les favoris : un crochet vert sur les offres où la personne a
postulé, retrouvables sur la page **« Mes candidatures »**. Colle et exécute aussi :

```sql
create table if not exists public.applications (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  job_id     text        not null,
  status     text        not null default 'postule',
  note       text,
  remind_at  date,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

alter table public.applications enable row level security;

-- Chacun ne lit / ajoute / retire QUE ses propres candidatures.
create policy "read own applications"   on public.applications for select using (auth.uid() = user_id);
create policy "insert own applications" on public.applications for insert with check (auth.uid() = user_id);
create policy "delete own applications" on public.applications for delete using (auth.uid() = user_id);
create policy "update own applications" on public.applications for update using (auth.uid() = user_id);

alter table public.applications add column if not exists status text not null default 'postule';
alter table public.applications add column if not exists note text;
alter table public.applications add column if not exists remind_at date;
```

> Tant que cette table n'existe pas, la fonctionnalité marche quand même en
> **local** (localStorage) — la synchro entre appareils s'active dès la table créée.

## 3. Activer le lien magique + les URLs de retour

1. **Authentication → Providers → Email** : activé (c'est le cas par défaut). Le lien
   magique passe par ce fournisseur (aucun mot de passe). Astuce : tu peux désactiver
   « Confirm email » pour que le tout premier lien connecte directement.
2. **Authentication → URL Configuration** :
   - **Site URL** : `https://cr4sh3ur.github.io/JobCCQ`
   - **Redirect URLs** (ajoute la ligne) : `https://cr4sh3ur.github.io/JobCCQ/favoris`
   
   (Le lien magique renvoie vers `/favoris`. Sans cette autorisation, Supabase refuse la redirection.)

## 4. Donner les clés au build (GitHub)

Dépôt GitHub → **Settings → Secrets and variables → Actions → onglet _Variables_ → New variable** :

| Nom | Valeur |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | l'URL du projet (étape 1) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clé **anon public** (étape 1) |
| `NEXT_PUBLIC_ADMIN_EMAILS` | *(optionnel)* courriel(s) admin, séparés par des virgules |

> Ce sont des **variables** (pas des secrets) car la clé anon est publique. Le workflow
> `deploy-pages.yml` les injecte dans le build. Relance un déploiement pour activer.

### Restreindre la console d'administration (`/admin`)

Quand Supabase est actif, la page `/admin` est **verrouillée** : l'accès exige une
connexion **et** un courriel présent dans `NEXT_PUBLIC_ADMIN_EMAILS`. Définis cette
variable avec ton courriel de compte (ex. `moi@courriel.com`, ou plusieurs séparés
par des virgules) puis relance un déploiement.

- Variable **absente** → console verrouillée (écran expliquant quoi configurer).
- Compte connecté hors liste → « Accès refusé ».
- Supabase non configuré → pas de comptes, donc pas de restriction possible : la page
  reste ouverte (l'accès effectif demeure protégé par les jetons GitHub/Turso qu'il
  faut saisir pour agir).

> Garde-fou d'**interface** (le site est statique, sans serveur) : la vraie protection
> des actions vient des jetons requis pour scraper / écrire dans Turso.

## Développement local

Crée `apps/web/.env.local` :

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Comment ça marche

- Déconnecté → favoris dans le navigateur (localStorage).
- À la connexion → les favoris anonymes déjà présents sont **fusionnés** dans le compte,
  puis tout est synchronisé via la table `favorites`.
- localStorage reste un cache : l'UI est instantanée et marche hors ligne ; la synchro
  se fait en arrière-plan.

---

# Coffre-fort des identifiants admin (chiffré)

La console `/admin` a besoin d'un **jeton GitHub** (scraper / publier) et des
**identifiants Turso** (éditer la base). Par défaut ils ne vivent que dans le
`localStorage` du navigateur courant. Le **coffre-fort** permet de les
**synchroniser d'un appareil à l'autre**, en les **chiffrant côté navigateur**
(AES-GCM, clé dérivée d'une phrase secrète via PBKDF2) **avant** de les stocker.
La base ne voit qu'un blob illisible ; la phrase secrète n'est jamais transmise
ni stockée, et se saisit une fois par appareil.

## Table + RLS (SQL, une seule fois)

**SQL Editor → New query**, colle et exécute :

```sql
create table if not exists public.admin_secrets (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  ciphertext text        not null,
  updated_at timestamptz not null default now()
);

alter table public.admin_secrets enable row level security;

-- Chacun ne lit / écrit QUE sa propre ligne.
create policy "read own secrets"   on public.admin_secrets for select using (auth.uid() = user_id);
create policy "insert own secrets" on public.admin_secrets for insert with check (auth.uid() = user_id);
create policy "update own secrets" on public.admin_secrets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own secrets" on public.admin_secrets for delete using (auth.uid() = user_id);
```

## Utilisation

Dans `/admin`, ouvre **« 🔐 Coffre-fort — synchroniser mes identifiants »** :

1. Connecte GitHub et/ou Turso comme d'habitude (les champs habituels).
2. Choisis une **phrase secrète** (≥ 8 caractères) → **« Enregistrer dans mon compte »**.
3. Sur un autre appareil : connecte-toi au compte, entre la **même phrase secrète**
   → **« Restaurer depuis mon compte »**. Les identifiants sont déchiffrés et rechargés.

> La sécurité repose sur deux couches : la **RLS** (personne d'autre ne lit ta ligne)
> **et** le **chiffrement** (même une fuite de la base ne révèle rien sans la phrase).
> Conseil : utilise un **jeton GitHub à granularité fine**, limité au seul dépôt et aux
> permissions strictement nécessaires (Contents + Actions), pour minimiser l'impact en
> cas de perte de la phrase.

---

# Municipalités → région (reclassement en direct)

La console `/admin` (onglet **« Régions & municipalités »**) associe une ville à une
région administrative. Le site lit cette table **au chargement** et reclasse les offres
**côté navigateur** : un changement s'applique **immédiatement, sans redéploiement**
(contrairement aux sources/employeurs qui passent par un instantané figé au build).

- **Lecture publique** (tout le monde peut lire → reclassement pour tous les visiteurs).
- **Écriture réservée aux admins** : la règle RLS vérifie le **courriel** du compte
  connecté (mets-y les mêmes courriels que `NEXT_PUBLIC_ADMIN_EMAILS`).

## Table + RLS (SQL, une seule fois)

**SQL Editor → New query**, colle et exécute (remplace le(s) courriel(s) admin) :

```sql
create table if not exists public.municipalities (
  norm       text        primary key,          -- nom normalisé (clé d'unicité)
  name       text        not null,             -- nom affiché de la ville
  region_id  text        not null,             -- id de région (QUEBEC_REGIONS)
  created_at timestamptz not null default now()
);

alter table public.municipalities enable row level security;

-- Lecture publique : le site lit la table pour reclasser les offres par ville.
create policy "read municipalities" on public.municipalities
  for select using (true);

-- Écriture réservée aux admins. Mets ici TON/TES courriel(s) admin
-- (les mêmes que NEXT_PUBLIC_ADMIN_EMAILS).
create policy "admins write municipalities" on public.municipalities
  for all
  using      ((auth.jwt() ->> 'email') = any (array['ton-courriel@admin.com']))
  with check ((auth.jwt() ->> 'email') = any (array['ton-courriel@admin.com']));

-- (Optionnel) Reprise de la municipalité déjà saisie avant le passage à Supabase :
insert into public.municipalities (norm, name, region_id) values
  ('la-matapedia', 'La Matapédia', 'bas-saint-laurent')
on conflict (norm) do nothing;
```

> Tant que la table n'existe pas, l'onglet affiche « aucune municipalité » et le site
> garde les régions de l'instantané — rien ne casse. Dès la table créée + un compte
> admin connecté, l'ajout/retrait est instantané.

## Import automatique des municipalités officielles

Déploie aussi l'Edge Function d'import :

```bash
supabase functions deploy import-municipalities
```

Elle télécharge côté serveur le fichier officiel MAMH « Liste des municipalités »
(`https://donneesouvertes.affmunqc.net/repertoire/MUN.csv`), puis upsert toutes les
municipalités dans `public.municipalities`. Elle ajoute aussi une liste d'**alias**
(localités, anciennes municipalités fusionnées, arrondissements de Montréal, secteurs
de Laval/Québec/Gatineau/Saguenay…) que le MAMH ne liste plus mais qui reviennent
souvent dans les offres — un alias n'écrase jamais une municipalité officielle de même
nom. En cas de deux municipalités de même nom (ex. « Clermont »), la plus peuplée est
retenue. Dans `/admin` → **Régions & municipalités**, le bouton **Importer tout**
déclenche cette fonction. La fonction exige :

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS` avec le ou les courriels autorisés

Aperçu parseur et fixture HTML hors API Fastify (GitHub Pages / Turso) :

```bash
supabase functions deploy admin-preview
```

`admin-preview` récupère le HTML d'une page carrières **sans CORS**. Même secrets
que l'import. Dans `/admin`, **Aperçu parseur** utilise d'abord `parseList` via
l'API locale si elle tourne, sinon JSON-LD / RSS dans le navigateur.

---

# Éditions d'offres en direct (sans redéploiement)

Le site public est un **export statique** qui lit un instantané `jobs.json` **figé
au build**. Sans rien de plus, une correction d'offre faite dans `/admin`
(titre, ville, région, salaire, description…) n'apparaît qu'au **prochain rebuild**.

La table `job_overrides` lève cette limite : chaque édition admin y est aussi
enregistrée sous forme de **patch** (les champs éditables de l'offre). Le site lit
cette table **au chargement** et **superpose** les patchs sur l'instantané côté
navigateur — exactement comme le reclassement municipalité → région. L'édition est
donc **visible immédiatement pour tous les visiteurs, sans redéploiement**.

- **Lecture publique** (tout le monde lit → l'édition s'applique pour tous).
- **Écriture réservée aux admins** : la règle RLS vérifie le **courriel** du compte
  connecté (mets-y les mêmes courriels que `NEXT_PUBLIC_ADMIN_EMAILS`).
- Le patch est **durable** : re-appliqué à chaque chargement, il survit même à un
  re-scrape qui réécrirait l'offre en base — la correction admin l'emporte tant
  qu'un admin ne la change pas.
- Le flag `offConstruction` (case **Hors construction** dans l'éditeur d'offre)
  masque l'offre du site public tout en la laissant visible dans `/admin`.

> En mode Turso/API, l'admin écrit dans la base (source de vérité) **et** dans cet
> overlay. En mode statique (aucun jeton Turso), l'overlay suffit à publier
> l'édition en direct dès que Supabase est configuré et le compte admin connecté.

## Table + RLS (SQL, une seule fois)

**SQL Editor → New query**, colle et exécute (remplace le(s) courriel(s) admin) :

```sql
create table if not exists public.job_overrides (
  job_id     text        primary key,          -- id de l'offre (modèle Job)
  patch      jsonb       not null default '{}'::jsonb,  -- champs éditables surchargés
  updated_at timestamptz not null default now()
);

alter table public.job_overrides enable row level security;

-- Lecture publique : le site lit les patchs pour surcharger les offres en direct.
create policy "read job_overrides" on public.job_overrides
  for select using (true);

-- Écriture réservée aux admins. Mets ici TON/TES courriel(s) admin
-- (les mêmes que NEXT_PUBLIC_ADMIN_EMAILS).
create policy "admins write job_overrides" on public.job_overrides
  for all
  using      ((auth.jwt() ->> 'email') = any (array['ton-courriel@admin.com']))
  with check ((auth.jwt() ->> 'email') = any (array['ton-courriel@admin.com']));
```

> Tant que la table n'existe pas, tout retombe proprement sur l'instantané figé
> (aucun overlay) — rien ne casse. Dès la table créée + un compte admin connecté,
> l'édition d'une offre est publiée en direct.

---

# Notifications par courriel (alertes emploi) — Resend

Un utilisateur connecté enregistre une **recherche** comme alerte (bouton « 🔔 Créer une
alerte » sur la page des offres, gérées sur `/alertes`). Après chaque scraping, un
workflow (`.github/workflows/notify.yml`) cherche les **nouvelles** offres qui
correspondent et envoie un courriel via **Resend**. Dormant tant que ce n'est pas
configuré (le script sort proprement).

## 1. Table des alertes (SQL, en plus de `favorites`)

```sql
create table if not exists public.job_alerts (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users (id) on delete cascade,
  label            text,
  query            jsonb       not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  last_notified_at timestamptz not null default now()
);

alter table public.job_alerts enable row level security;

create policy "read own alerts"   on public.job_alerts for select using (auth.uid() = user_id);
create policy "insert own alerts" on public.job_alerts for insert with check (auth.uid() = user_id);
create policy "delete own alerts" on public.job_alerts for delete using (auth.uid() = user_id);
```

> L'envoi tourne côté CI avec la **clé `service_role`** (hors RLS) : il lit toutes les
> alertes et résout l'adresse courriel de façon fiable via l'API admin (jamais une
> adresse fournie par le client).

## 2. Compte Resend

1. https://resend.com → crée une clé API (**API Keys**).
2. Expéditeur : soit `onboarding@resend.dev` (test), soit **vérifie ton domaine**
   (Domains) pour envoyer depuis `alertes@ton-domaine.com` (recommandé en production).

## 3. Secrets / variables GitHub (Actions)

| Nom | Type | Valeur |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | clé `service_role` (Supabase → Project Settings → API) |
| `RESEND_API_KEY` | **Secret** | clé API Resend |
| `NOTIFY_FROM` | Variable | ex. `JobCCQ <alertes@ton-domaine.com>` (ou `JobCCQ <onboarding@resend.dev>`) |

> `NEXT_PUBLIC_SUPABASE_URL` (déjà ajoutée pour les comptes) est réutilisée par l'envoi.
> `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` (déjà présentes pour le scraping) donnent
> accès aux offres.

## 4. Déclenchement

`notify.yml` s'exécute **après chaque scraping réussi** (`workflow_run`) et peut être
lancé à la main (onglet **Actions → Notifier les alertes emploi → Run workflow**). Seules
les offres créées **depuis le dernier envoi** de chaque alerte sont incluses (pas de
doublon, pas de spam d'anciennes offres).

# Clics « Postuler » (stats admin)

Chaque clic sur **Postuler** (fiche, comparateur, widget iframe) est enregistré :

- **localStorage** (`jobccq:apply-clicks`) — miroir de ce navigateur ;
- **table `apply_clicks`** — tous les visiteurs (insert anonyme), lecture **admin**.

Le tableau de bord `/admin` (vue d'ensemble) affiche le top par source et par offre.

## Table + RLS (SQL, une seule fois)

**SQL Editor → New query**, colle et exécute (remplace le courriel admin) :

```sql
create table if not exists public.apply_clicks (
  id         uuid        primary key default gen_random_uuid(),
  job_id     text        not null,
  source_id  text        not null,
  title      text,
  at         timestamptz not null default now()
);

create index if not exists apply_clicks_at_idx on public.apply_clicks (at desc);
create index if not exists apply_clicks_source_idx on public.apply_clicks (source_id);

alter table public.apply_clicks enable row level security;

create policy "insert apply_clicks" on public.apply_clicks
  for insert to anon, authenticated
  with check (true);

create policy "admins read apply_clicks" on public.apply_clicks
  for select to authenticated
  using ((auth.jwt() ->> 'email') = any (array['ton-courriel@admin.com']));
```

# Notifications push Expo (app mobile)

L'app enregistre un **jeton Expo** dans `push_tokens`. Après chaque scrape, le
même workflow `notify.yml` envoie un résumé des nouvelles offres via l'API
publique Expo (`https://exp.host/--/api/v2/push/send`) — **aucun secret Expo**.

Dans l'app : onglet **Favoris** → « Activer les notifications » (téléphone
physique + Expo Go). Variables `EXPO_PUBLIC_SUPABASE_URL` et
`EXPO_PUBLIC_SUPABASE_ANON_KEY` (même projet que le site).

```sql
create table if not exists public.push_tokens (
  token            text        primary key,
  user_id          uuid        references auth.users (id) on delete set null,
  query            jsonb       not null default '{}'::jsonb,
  enabled          boolean     not null default true,
  platform         text,
  last_notified_at timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

create policy "insert push token" on public.push_tokens
  for insert to anon, authenticated with check (true);

create policy "update push token" on public.push_tokens
  for update to anon, authenticated using (true) with check (true);

create policy "delete push token" on public.push_tokens
  for delete to anon, authenticated using (true);
```

> Pas de `SELECT` public : le cron lit la table avec la clé `service_role`.

