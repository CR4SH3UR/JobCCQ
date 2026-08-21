# Proxy sortant pour le scraping (Jobillico)

Certains sites — **Jobillico** notamment — renvoient **HTTP 403** aux adresses IP
de GitHub Actions. Résultat : le scraping planifié ne peut pas rafraîchir ces
sites (ils gardent leurs offres grâce au mode « sync », mais ne se mettent pas à
jour tout seuls).

La solution : router **seulement ces requêtes** via un petit proxy dont l'IP
n'est pas bloquée. Le plus simple et **gratuit** : un **Cloudflare Worker**.

> Tout est **optionnel**. Sans proxy configuré, rien ne change : Jobillico n'est
> simplement pas rafraîchi automatiquement.

---

## Option A — Cloudflare Worker (gratuit)

### 1. Déployer le Worker

1. Crée un compte gratuit sur <https://dash.cloudflare.com> → **Workers & Pages**
   → **Create** → **Create Worker**. Donne-lui un nom (ex. `jobccq-proxy`) et
   **Deploy**.
2. Clique **Edit code**, remplace tout par le contenu de
   [`infra/jobillico-proxy-worker.js`](./jobillico-proxy-worker.js), puis
   **Deploy**.
3. Note l'URL publique du Worker (ex. `https://jobccq-proxy.<compte>.workers.dev`).

### 2. Configurer le jeton (secret du Worker)

Dans le Worker → **Settings** → **Variables and Secrets** :

| Nom          | Type   | Valeur                                             |
| ------------ | ------ | -------------------------------------------------- |
| `PROXY_TOKEN`| Secret | une longue chaîne aléatoire (ton mot de passe)     |
| `ALLOW_HOSTS`| Text   | `jobillico.com` (défaut ; laisse tel quel)         |

Génère un jeton, par exemple : `openssl rand -hex 24`.

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

| Variable              | Défaut          | Rôle                                                        |
| --------------------- | --------------- | ----------------------------------------------------------- |
| `SCRAPE_PROXY_URL`    | *(vide)*        | endpoint proxy ; vide = aucun proxy (comportement actuel)   |
| `SCRAPE_PROXY_TOKEN`  | *(vide)*        | jeton partagé, ajouté en `?token=` (ou `{token}`)           |
| `SCRAPE_PROXY_HOSTS`  | `jobillico.com` | hôtes routés via le proxy (CSV) ; vide = tous               |

Seuls les hôtes listés passent par le proxy : les ~1150 autres sites continuent
en direct (rapide, pas de quota consommé).
