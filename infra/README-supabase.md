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

> Ce sont des **variables** (pas des secrets) car la clé anon est publique. Le workflow
> `deploy-pages.yml` les injecte dans le build. Relance un déploiement pour activer.

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

