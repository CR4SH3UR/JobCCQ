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
