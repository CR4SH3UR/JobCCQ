# Proxy sortant pour le scraping (sites qui bloquent les IP de CI)

Certains sites — **Jobillico** notamment, mais aussi de plus petits sites
carrières (ex. `desfor.com`, `alarme-bois-francs.com`) — traitent mal les
adresses IP de **centre de données** de GitHub Actions : soit un **HTTP 403**,
soit une connexion coupée, soit une **page « 200 » vide/de défi** (0 offre).
Résultat : le scraping planifié ne peut pas rafraîchir ces sites (ils gardent
leurs offres grâce au mode « sync », mais ne se mettent pas à jour tout seuls).

La solution : router ces requêtes via un petit proxy dont l'IP n'est pas
bloquée. Le plus simple et **gratuit** : un **Cloudflare Worker**.

> **Deux façons dont une requête part vers le proxy :**
>
> 1. **Repli automatique** — si une requête **directe échoue** (connexion
>    refusée/coupée, 403, 5xx), le scraper retente **une fois** via le proxy,
>    pour **n'importe quel** hôte. Aucune liste à tenir.
> 2. **Liste explicite** (`SCRAPE_PROXY_HOSTS`) — pour les sites qui répondent
>    « 200 » avec une page vide (le repli ne se déclenche pas, la requête
>    « réussissant ») : ces hôtes passent **toujours** par le proxy.
>
> Dans les deux cas, l'hôte doit être autorisé **côté Worker** (`ALLOW_HOSTS`).
> Le plus commode : `ALLOW_HOSTS = *` (voir ci-dessous) — le jeton reste exigé.

> Tout est **optionnel**. Sans proxy configuré, rien ne change : Jobillico n'est
> simplement pas rafraîchi automatiquement.

---

## Option A — Cloudflare Worker (gratuit)

### 1. Déployer le Worker

> ⚠️ **N'utilise pas le glisser-déposer de fichiers** du tableau de bord : il
> refuse un `.js` seul (« _This uploader does not yet support projects that
> require a build process… use `wrangler deploy`_ »). Prends **A1 (wrangler)** —
> c'est ce que Cloudflare recommande — ou **A2 (éditeur en ligne)**.

#### A1. Avec Wrangler (recommandé)

Tout est déjà prêt dans `infra/` (`wrangler.toml` + le Worker). Depuis le dépôt :

```bash
cd infra
npx wrangler login                    # ouvre le navigateur, autorise
npx wrangler secret put PROXY_TOKEN   # colle un jeton aléatoire, garde-le
npx wrangler deploy
```

Génère le jeton avec `openssl rand -hex 24`. À la fin, Wrangler affiche l'URL
publique (`https://jobccq-proxy.<compte>.workers.dev`) — note-la. **Passe à
l'étape 3** (le jeton est déjà configuré).

#### A2. Sans Wrangler (éditeur en ligne)

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create** →
   **Create Worker** (modèle « Hello World ») → **Deploy**.
2. Ouvre **Edit code**, remplace **tout** par le contenu de
   [`infra/jobillico-proxy-worker.js`](./jobillico-proxy-worker.js) → **Deploy**.
3. Note l'URL du Worker, puis fais l'étape 2 ci-dessous (jeton).

### 2. Configurer le jeton (seulement pour A2)

Dans le Worker → **Settings** → **Variables and Secrets** :

| Nom          | Type   | Valeur                                             |
| ------------ | ------ | -------------------------------------------------- |
| `PROXY_TOKEN`| Secret | une longue chaîne aléatoire (ton mot de passe)     |
| `ALLOW_HOSTS`| Text   | `*` (recommandé : autorise tout hôte, jeton exigé) |

Génère un jeton, par exemple : `openssl rand -hex 24`.

> `ALLOW_HOSTS = *` autorise le proxy à relayer n'importe quel hôte — **mais
> uniquement avec le bon jeton**, donc ce n'est pas un relais ouvert. C'est ce
> qui permet au **repli automatique** de rattraper tout site qui bloque les IP
> de CI, sans devoir inscrire chaque hôte à la main. Tu peux aussi lister des
> hôtes précis (`jobillico.com,desfor.com`) si tu préfères restreindre.
>
> **Avec Wrangler** (au lieu du tableau de bord) :
> `cd infra && echo "*" | npx wrangler secret put ALLOW_HOSTS` — ou mets
> `[vars] ALLOW_HOSTS = "*"` dans `wrangler.toml` puis `npx wrangler deploy`.

### 3. Donner l'URL + le jeton à GitHub Actions

Dans le dépôt GitHub → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**, ajoute :

| Secret               | Valeur                                                    |
| -------------------- | -------------------------------------------------------- |
| `SCRAPE_PROXY_URL`   | l'URL du Worker (ex. `https://jobccq-proxy.xxx.workers.dev`) |
| `SCRAPE_PROXY_TOKEN` | le même jeton que `PROXY_TOKEN`                           |

C'est tout. Au prochain scraping (planifié le lundi, ou lancé manuellement via
**Actions → Scraper les offres → Run workflow**), les requêtes Jobillico passent
par le Worker. Vérifie dans les logs : plus de `HTTP 403` sur `jobillico.com`.

### Tester le Worker à la main

```
curl "https://jobccq-proxy.xxx.workers.dev/?url=https%3A%2F%2Fwww.jobillico.com%2Fvoir-entreprise%2Fnordex&token=TON_JETON"
```

Une page HTML (statut 200) = OK. `403 Forbidden` = jeton absent/incorrect.
`Host not allowed` = l'hôte n'est pas dans `ALLOW_HOSTS`.

---

## Option B — Service de scraping commercial

Le scraper accepte n'importe quel proxy « fetch ». Pour un service à API (ex.
ScraperAPI, ScrapingBee, ZenRows), mets un **gabarit** avec `{url}` dans
`SCRAPE_PROXY_URL` (secret GitHub) :

```
https://api.scraperapi.com/?api_key=TA_CLE&url={url}
```

Le scraper remplace `{url}` par l'URL cible encodée. `{token}` est aussi
substitué si présent. Ces services utilisent souvent des IP résidentielles :
utile si un jour Cloudflare est bloqué à son tour.

---

## Comment ça marche (variables lues par le scraper)

| Variable              | Défaut                                          | Rôle                                                        |
| --------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| `SCRAPE_PROXY_URL`    | *(vide)*                                        | endpoint proxy ; vide = aucun proxy (comportement actuel)   |
| `SCRAPE_PROXY_TOKEN`  | *(vide)*                                        | jeton partagé, ajouté en `?token=` (ou `{token}`)           |
| `SCRAPE_PROXY_HOSTS`  | `jobillico.com,desfor.com,alarme-bois-francs.com` | hôtes **toujours** routés via le proxy (CSV) ; `*` ou vide = tous |

Seuls les hôtes listés passent **d'emblée** par le proxy ; les autres sites
continuent en direct (rapide, pas de quota consommé) et ne basculent sur le
proxy qu'en **repli**, si la requête directe échoue. Côté Worker, l'hôte doit
être permis par `ALLOW_HOSTS` (`*` = tous).
