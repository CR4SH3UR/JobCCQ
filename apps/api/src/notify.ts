/**
 * Notifications par courriel des **alertes emploi** (Resend).
 *
 * Exécuté en CI après chaque scraping (voir .github/workflows/notify.yml) :
 *  1. lit les alertes des utilisateurs dans Supabase (clé service_role → hors RLS) ;
 *  2. cherche dans Turso les offres **nouvelles** (créées depuis le dernier envoi)
 *     qui correspondent aux critères de chaque alerte (logique de filtrage
 *     partagée `applyQuery`) ;
 *  3. envoie un courriel récapitulatif via Resend ;
 *  4. avance `last_notified_at` pour ne pas renvoyer les mêmes offres.
 *
 * Tout est no-op (sortie 0) si les variables ne sont pas configurées → le
 * workflow ne casse pas tant que Supabase/Resend ne sont pas branchés.
 */
import { createClient } from "@supabase/supabase-js";
import { applyQuery, type Job, type JobQuery } from "@jobccq/shared";
import { prisma } from "./db.js";
import { rowToJob } from "./repository.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY_FROM = process.env.NOTIFY_FROM || "JobCCQ <onboarding@resend.dev>";
const SITE_URL = (process.env.NOTIFY_SITE_URL || "https://cr4sh3ur.github.io/JobCCQ").replace(/\/+$/, "");
const MAX_PER_EMAIL = 30;

type AlertRow = {
  id: string;
  user_id: string;
  label: string | null;
  query: Partial<JobQuery>;
  last_notified_at: string;
};

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
  if (!SUPABASE_URL || !SERVICE_KEY || !RESEND_API_KEY) {
    console.log("Notifications désactivées (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / RESEND_API_KEY manquants).");
    return;
  }
  const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: alerts, error } = await supa.from("job_alerts").select("id,user_id,label,query,last_notified_at");
  if (error) {
    console.error("Lecture des alertes échouée:", error.message);
    process.exitCode = 1;
    return;
  }
  if (!alerts || alerts.length === 0) {
    console.log("Aucune alerte enregistrée.");
    return;
  }

  // Fenêtre globale : on charge une fois les offres créées après le plus ancien
  // « dernier envoi » de toutes les alertes, puis on filtre par alerte.
  const oldest = (alerts as AlertRow[]).reduce(
    (min, a) => Math.min(min, new Date(a.last_notified_at).getTime()),
    Date.now(),
  );
  const rows = await prisma.job.findMany({ where: { createdAt: { gt: new Date(oldest) } } });
  const createdAtById = new Map(rows.map((r) => [r.id, r.createdAt.getTime()]));
  const newJobs = rows.map(rowToJob);
  console.log(`${alerts.length} alerte(s) · ${newJobs.length} offre(s) nouvelles depuis ${new Date(oldest).toISOString()}`);

  let sent = 0;
  for (const alert of alerts as AlertRow[]) {
    const cutoff = new Date(alert.last_notified_at).getTime();
    const candidates = newJobs.filter((j) => (createdAtById.get(j.id) ?? 0) > cutoff);
    if (candidates.length === 0) continue;

    const query = {
      ...alert.query,
      sort: alert.query.sort ?? "recent",
      page: 1,
      pageSize: MAX_PER_EMAIL,
    } as JobQuery;
    const matched = applyQuery(candidates, query).items;
    if (matched.length === 0) continue;

    // Email résolu côté serveur (service_role) : on ne fait jamais confiance à
    // une adresse fournie par le client (anti-usurpation).
    const { data: userRes } = await supa.auth.admin.getUserById(alert.user_id);
    const email = userRes?.user?.email;
    if (!email) continue;

    const label = alert.label?.trim() || "Nouvelles offres";
    if (await sendEmail(email, label, matched)) {
      await supa.from("job_alerts").update({ last_notified_at: new Date().toISOString() }).eq("id", alert.id);
      sent += 1;
      console.log(`✉️  ${email} — ${matched.length} offre(s) · « ${label} »`);
    }
  }
  console.log(`Terminé : ${sent} courriel(s) envoyé(s).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Erreur notify:", err);
  process.exitCode = 1;
});
