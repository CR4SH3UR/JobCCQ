/**
 * Notifications par courriel des **alertes emploi** (Resend).
 *
 * Exécuté en CI après chaque scraping (voir .github/workflows/notify.yml) :
 *  1. lit les alertes des utilisateurs dans Supabase (clé service_role → hors RLS) ;
 *  2. cherche dans Turso les offres **nouvelles** (créées depuis le dernier envoi)
 *     qui correspondent aux critères de chaque alerte (logique de filtrage
 *     partagée `applyQuery`) ;
 *  3. envoie un courriel récapitulatif via Resend et/ou un push Expo ;
 *  4. avance `last_notified_at` pour ne pas renvoyer les mêmes offres.
 *
 * Tout est no-op (sortie 0) si les variables ne sont pas configurées → le
 * workflow ne casse pas tant que Supabase/Resend ne sont pas branchés.
 */
import { createClient } from "@supabase/supabase-js";
import { applyQuery, type Job, type JobQuery } from "@jobccq/shared";
import { prisma } from "./db.js";
import { rowToJob } from "./repository.js";
import { formatJobsWebhook, postWebhook } from "./webhooks.js";
import { formatExpoPush, sendExpoPush } from "./expo-push.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY_FROM = process.env.NOTIFY_FROM || "JobCCQ <onboarding@resend.dev>";
const SITE_URL = (process.env.NOTIFY_SITE_URL || "https://cr4sh3ur.github.io/JobCCQ").replace(/\/+$/, "");
const MAX_PER_EMAIL = 30;
const HOUR = 3_600_000;

function shouldSkipByFrequency(freq: string | undefined, lastAt: number, now: number): boolean {
  if (freq === "daily") return now - lastAt < 20 * HOUR;
  if (freq === "weekly") return now - lastAt < 6 * 24 * HOUR;
  return false;
}

type AlertRow = {
  id: string;
  user_id: string;
  label: string | null;
  query: Partial<JobQuery>;
  last_notified_at: string;
};

type PushTokenRow = {
  token: string;
  user_id: string | null;
  query: Partial<JobQuery>;
  last_notified_at: string;
  enabled: boolean;
};

function matchNewJobs(
  newJobs: Job[],
  createdAtById: Map<string, number>,
  query: Partial<JobQuery>,
  cutoff: number,
): Job[] {
  const candidates = newJobs.filter((j) => (createdAtById.get(j.id) ?? 0) > cutoff);
  if (candidates.length === 0) return [];
  const q = {
    ...query,
    sort: query.sort ?? "recent",
    page: 1,
    pageSize: MAX_PER_EMAIL,
  } as JobQuery;
  return applyQuery(candidates, q).items;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function emailHtml(label: string, jobs: Job[]): string {
  const items = jobs
    .slice(0, MAX_PER_EMAIL)
    .map(
      (j) =>
        `<li style="margin:0 0 10px"><a href="${esc(j.url)}" style="color:#2563eb;font-weight:600;text-decoration:none">${esc(
          j.title,
        )}</a><br><span style="color:#475569;font-size:14px">${esc(j.company)}${
          j.city ? " · " + esc(j.city) : ""
        }</span></li>`,
    )
    .join("");
  return `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto">
    <h2 style="color:#0f172a">Nouvelles offres — ${esc(label)}</h2>
    <p style="color:#475569">${jobs.length} nouvelle${jobs.length > 1 ? "s" : ""} offre${
      jobs.length > 1 ? "s" : ""
    } correspond${jobs.length > 1 ? "ent" : ""} à ton alerte :</p>
    <ul style="list-style:none;padding:0">${items}</ul>
    <p style="font-size:13px;color:#94a3b8">
      <a href="${SITE_URL}/emplois" style="color:#2563eb">Voir toutes les offres</a> ·
      <a href="${SITE_URL}/alertes" style="color:#2563eb">Gérer / supprimer mes alertes</a>
    </p></div>`;
}

async function sendEmail(to: string, label: string, jobs: Job[]): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: NOTIFY_FROM,
      to,
      subject: `JobCCQ — ${jobs.length} nouvelle${jobs.length > 1 ? "s" : ""} offre${jobs.length > 1 ? "s" : ""} · ${label}`,
      html: emailHtml(label, jobs),
    }),
  });
  if (!res.ok) {
    console.error("Resend erreur:", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.log("Notifications désactivées (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants).");
    await notifyAdminHooks();
    await prisma.$disconnect();
    return;
  }
  if (!RESEND_API_KEY) {
    console.log("Resend absent : pas de courriels (webhooks d'alerte toujours envoyés).");
  }
  const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: alerts, error } = await supa.from("job_alerts").select("id,user_id,label,query,last_notified_at");
  if (error) {
    console.error("Lecture des alertes échouée:", error.message);
    process.exitCode = 1;
    return;
  }
  const { data: tokenData, error: tokenErr } = await supa
    .from("push_tokens")
    .select("token,user_id,query,last_notified_at,enabled")
    .eq("enabled", true);
  if (tokenErr) {
    console.log("Jetons push ignorés :", tokenErr.message);
  }

  const alertRows = (alerts ?? []) as AlertRow[];
  const tokenRows = (tokenErr ? [] : (tokenData ?? [])) as PushTokenRow[];
  if (alertRows.length === 0 && tokenRows.length === 0) {
    console.log("Aucune alerte ni jeton push.");
    await notifyAdminHooks();
    await prisma.$disconnect();
    return;
  }

  // Fenêtre globale : offres créées après le plus ancien « dernier envoi ».
  const oldest = [...alertRows.map((a) => new Date(a.last_notified_at).getTime()), ...tokenRows.map((t) => new Date(t.last_notified_at).getTime())].reduce(
    (min, t) => Math.min(min, t),
    Date.now(),
  );
  const rows = await prisma.job.findMany({ where: { createdAt: { gt: new Date(oldest) } } });
  const createdAtById = new Map(rows.map((r) => [r.id, r.createdAt.getTime()]));
  const newJobs = rows.map(rowToJob);
  console.log(
    `${alertRows.length} alerte(s) · ${tokenRows.length} jeton(s) · ${newJobs.length} offre(s) depuis ${new Date(oldest).toISOString()}`,
  );

  const matchedByUser = new Map<string, Job[]>();
  let sent = 0;
  for (const alert of alertRows) {
    if (alert.query.alertPaused) continue;
    const cutoff = new Date(alert.last_notified_at).getTime();
    if (shouldSkipByFrequency(alert.query.alertFrequency, cutoff, Date.now())) continue;
    const matched = matchNewJobs(newJobs, createdAtById, alert.query, cutoff);
    if (matched.length === 0) continue;

    const prev = matchedByUser.get(alert.user_id) ?? [];
    const seen = new Set(prev.map((j) => j.id));
    matchedByUser.set(alert.user_id, [...prev, ...matched.filter((j) => !seen.has(j.id))]);

    const { data: userRes } = await supa.auth.admin.getUserById(alert.user_id);
    const email = userRes?.user?.email;
    const label = alert.label?.trim() || "Nouvelles offres";
    const hook = alert.query.webhookUrl?.trim();
    let ok = false;
    if (hook) {
      ok = await postWebhook(hook, formatJobsWebhook(label, matched), "JobCCQ");
    }
    if (email && RESEND_API_KEY && (await sendEmail(email, label, matched))) ok = true;
    if (ok) {
      await supa.from("job_alerts").update({ last_notified_at: new Date().toISOString() }).eq("id", alert.id);
      sent += 1;
      console.log(`✉️  ${email ?? "webhook"} — ${matched.length} offre(s) · « ${label} »`);
    }
  }

  let pushed = 0;
  for (const row of tokenRows) {
    const cutoff = new Date(row.last_notified_at).getTime();
    const fromAlert = row.user_id ? matchedByUser.get(row.user_id) ?? [] : [];
    const pool = fromAlert.length
      ? fromAlert
      : matchNewJobs(newJobs, createdAtById, row.query ?? {}, cutoff);
    const matched = pool.filter((j) => (createdAtById.get(j.id) ?? 0) > cutoff);
    if (matched.length === 0) continue;
    const n = await sendExpoPush([row.token], formatExpoPush(matched, "Nouvelles offres"));
    if (n > 0) {
      await supa.from("push_tokens").update({ last_notified_at: new Date().toISOString() }).eq("token", row.token);
      pushed += 1;
      console.log(`📱  jeton …${row.token.slice(-8)} — ${matched.length} offre(s)`);
    }
  }
  console.log(`Terminé : ${sent} courriel(s) · ${pushed} push.`);
  await notifyAdminHooks();
  await prisma.$disconnect();
}

/** Fin de scrape + sources tombées à 0 (WEBHOOK_SCRAPE_URL). */
async function notifyAdminHooks(): Promise<void> {
  const url = process.env.WEBHOOK_SCRAPE_URL?.trim();
  if (!url) return;
  const since = new Date(Date.now() - 8 * HOUR);
  const runs = await prisma.scrapeRun.findMany({
    where: { finishedAt: { gte: since } },
    orderBy: { id: "desc" },
    take: 400,
  });
  const latest = new Map<string, (typeof runs)[number]>();
  for (const r of runs) {
    if (!latest.has(r.sourceId)) latest.set(r.sourceId, r);
  }
  const ok = [...latest.values()].filter((r) => r.status === "success").length;
  const err = [...latest.values()].filter((r) => r.status === "error").length;
  const dropped: string[] = [];
  const bySource = new Map<string, typeof runs>();
  for (const r of runs) {
    const list = bySource.get(r.sourceId) ?? [];
    list.push(r);
    bySource.set(r.sourceId, list);
  }
  for (const [id, list] of bySource) {
    const [cur, prev] = list;
    if (cur && prev && cur.found === 0 && prev.found >= 8) dropped.push(`${id} (${prev.found} → 0)`);
  }
  const text = [
    `${latest.size} source(s) · ${ok} succès · ${err} erreur(s)`,
    dropped.length ? `⚠ tombées à 0 : ${dropped.join(", ")}` : "Aucune grosse source à 0.",
  ].join("\n");
  const sent = await postWebhook(url, text, "JobCCQ — scrape");
  console.log(sent ? "Webhook scrape envoyé." : "Webhook scrape échoué.");
}

main().catch((err) => {
  console.error("Erreur notify:", err);
  process.exitCode = 1;
});
