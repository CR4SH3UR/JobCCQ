/**
 * Proxy « fetch » minimal pour JobCCQ — Cloudflare Worker (offre gratuite).
 *
 * But : certains sites (Jobillico) renvoient HTTP 403 aux IP de GitHub Actions.
 * Le scraper route alors ses requêtes via ce Worker, dont l'IP sortante (réseau
 * Cloudflare) n'est pas bloquée → les offres Jobillico se rafraîchissent aussi
 * lors du scraping planifié.
 *
 * Sécurité : le Worker n'est PAS un relais ouvert.
 *  - il exige un jeton partagé (secret PROXY_TOKEN) ;
 *  - il ne relaie que les hôtes autorisés (ALLOW_HOSTS, défaut « jobillico.com »).
 *
 * Déploiement : voir infra/README-proxy.md.
 *
 * Contrat d'appel (ce qu'envoie le scraper) :
 *   GET https://<worker>.workers.dev/?url=<URL-cible-encodée>&token=<PROXY_TOKEN>
 */

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export default {
  async fetch(request, env) {
    const inUrl = new URL(request.url);
    const target = inUrl.searchParams.get("url");
    const token =
      inUrl.searchParams.get("token") ||
      (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

    // 1) Jeton obligatoire (si configuré).
    if (env.PROXY_TOKEN && token !== env.PROXY_TOKEN) {
      return new Response("Forbidden", { status: 403 });
    }
    // 2) URL cible valide.
    if (!target) return new Response("Missing ?url=", { status: 400 });
    let t;
    try {
      t = new URL(target);
    } catch {
      return new Response("Bad url", { status: 400 });
    }
    if (t.protocol !== "http:" && t.protocol !== "https:") {
      return new Response("Bad scheme", { status: 400 });
    }
    // 3) Allowlist d'hôtes (anti relais ouvert). « * » = tous les hôtes
    //    (le jeton reste obligatoire → ce n'est pas un relais ouvert). Pratique
    //    quand beaucoup de sites bloquent les IP de CI : on évite d'ajouter
    //    chaque hôte à la main des deux côtés.
    const allow = (env.ALLOW_HOSTS || "jobillico.com")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const ok =
      allow.includes("*") ||
      allow.some((h) => t.hostname === h || t.hostname.endsWith(`.${h}`));
    if (!ok) return new Response("Host not allowed", { status: 403 });

    // 4) Récupère la cible avec un User-Agent de navigateur.
    let res;
    try {
      res = await fetch(t.toString(), {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": env.FORWARD_UA || DEFAULT_UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.6",
        },
      });
    } catch (e) {
      return new Response(`Upstream error: ${e}`, { status: 502 });
    }

    // 5) Renvoie le corps + statut (le scraper interprète 403/5xx comme un échec
    //    → il conserve les offres existantes, jamais de purge).
    return new Response(res.body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  },
};
