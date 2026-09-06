/**
 * Notifications : **alertes emploi** + **rappels de candidature** (Resend,
 * Expo, ntfy, webhooks).
 *
 * Exécuté en CI après chaque scraping et tous les jours (notify.yml) :
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
import { applyQuery, reminderNeedsNotify, type Job, type JobQuery } from "@jobccq/shared";
import { prisma } from "./db.js";
import { rowToJob } from "./repository.js";
import { formatJobsWebhook, postWebhook } from "./webhooks.js";
import { formatExpoPush, sendExpoPush } from "./expo-push.js";
import { postNtfy } from "./ntfy.js";
import { formatScrapeNtfy, parseScrapeDiff } from "./scrape-ntfy.js";
import {
  collectAlertChannels,
  formatReminderEmailHtml,
  formatReminderEmailSubject,
  formatReminderNtfy,
  formatReminderPush,
  labelForReminderStatus,
  type DueApplicationReminder,
} from "./notify-reminders.js";

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

async function sendHtmlEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: NOTIFY_FROM, to, subject, html }),
  });
  if (!res.ok) {
    console.error("Resend erreur:", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

async function sendEmail(to: string, label: string, jobs: Job[]): Promise<boolean> {
  return sendHtmlEmail(
    to,
    `JobCCQ — ${jobs.length} nouvelle${jobs.length > 1 ? "s" : ""} offre${jobs.length > 1 ? "s" : ""} · ${label}`,
    emailHtml(label, jobs),
  );
}

type ApplicationRow = {
  user_id: string;
  job_id: string;
  status: string | null;
  note: string | null;
  remind_at: string | null;
  remind_notified_at: string | null;
};

/** Client service_role : pas de schéma généré, chaînage `from().select()…`. */
type NotifySupabase = {
  from: (table: string) => {
    select: (cols: string) => {
      not: (col: string, op: string, val: null) => PromiseLike<{ data: ApplicationRow[] | null; error: { message: string } | null }>;
      eq: (col: string, val: string) => {
        eq: (col: string, val: boolean) => PromiseLike<{ data: Array<{ token?: string }> | null }>;
      } & PromiseLike<{ data: Array<{ query?: { ntfyTopic?: string; webhookUrl?: string } }> | null }>;
    };
    update: (row: Record<string, unknown>) => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => PromiseLike<{ error: { message: string } | null }>;
      };
    };
  };
  auth: {
    admin: {
      getUserById: (id: string) => PromiseLike<{ data: { user?: { email?: string } | null } }>;
    };
  };
};

/** Rappels « Relancer le » de Mes candidatures — courriel, ntfy, webhook, push. */
async function notifyApplicationReminders(supa: NotifySupabase): Promise<number> {
  const { data, error } = await supa
    .from("applications")
    .select("user_id, job_id, status, note, remind_at, remind_notified_at")
    .not("remind_at", "is", null);
  if (error) {
    console.log("Rappels candidatures ignorés :", error.message);
    return 0;
  }
  const now = new Date();
  const due = ((data ?? []) as ApplicationRow[]).filter((r) =>
    reminderNeedsNotify(r.remind_at, r.remind_notified_at, now),
  );
  if (due.length === 0) {
    console.log("Aucun rappel de candidature échu.");
    return 0;
  }

  const jobIds = [...new Set(due.map((r) => r.job_id))];
  const jobs = (await prisma.job.findMany({
    where: { id: { in: jobIds } },
    select: { id: true, title: true, company: true, url: true },
  })) as Array<{ id: string; title: string; company: string }>;
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  const byUser = new Map<string, ApplicationRow[]>();
  for (const row of due) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const candidaturesUrl = `${SITE_URL}/candidatures`;
  let sent = 0;
  for (const [uid, rows] of byUser) {
    const items: DueApplicationReminder[] = rows.map((r) => {
      const j = jobById.get(r.job_id);
      return {
        jobId: r.job_id,
        title: j?.title ?? r.job_id,
        company: j?.company ?? "",
        status: labelForReminderStatus(r.status),
        note: r.note ?? "",
        remindAt: (r.remind_at ?? "").slice(0, 10),
        url: `${SITE_URL}/emplois/${r.job_id}/`,
      };
    });

    const { data: userRes } = await supa.auth.admin.getUserById(uid);
    const email = userRes?.user?.email;
    const { data: alertData } = await supa.from("job_alerts").select("query").eq("user_id", uid);
    const channels = collectAlertChannels((alertData ?? []).map((a) => a.query));
    const { data: tokenData } = await supa
      .from("push_tokens")
      .select("token")
      .eq("user_id", uid)
      .eq("enabled", true);

    const ntfyMsg = formatReminderNtfy(items);
    const pushMsg = formatReminderPush(items);
    let ok = false;
    if (email && (await sendHtmlEmail(email, formatReminderEmailSubject(items), formatReminderEmailHtml(items, candidaturesUrl)))) {
      ok = true;
    }
    for (const topic of channels.ntfy) {
      if (await postNtfy(topic, ntfyMsg.title, ntfyMsg.body, candidaturesUrl)) ok = true;
    }
    for (const hook of channels.webhooks) {
      if (await postWebhook(hook, ntfyMsg.body, ntfyMsg.title)) ok = true;
    }
    const tokens = (tokenData ?? []).map((t) => String(t.token ?? "")).filter(Boolean);
    if (tokens.length && (await sendExpoPush(tokens, { title: pushMsg.title, body: pushMsg.body, data: { jobId: pushMsg.jobId } })) > 0) {
      ok = true;
    }

    if (!ok) {
      console.log(`Rappel candidature non envoyé (aucun canal) · ${uid.slice(0, 8)}… · ${items.length}`);
      continue;
    }
    const stamp = now.toISOString();
    for (const r of rows) {
      const { error: upErr } = await supa
        .from("applications")
        .update({ remind_notified_at: stamp })
        .eq("user_id", uid)
        .eq("job_id", r.job_id);
      if (upErr) console.error("remind_notified_at :", upErr.message);
    }
    sent += 1;
    console.log(`⏰  ${email ?? uid.slice(0, 8)} — ${items.length} rappel(s) de candidature`);
  }
  return sent;
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
  const reminderSent = await notifyApplicationReminders(supa as NotifySupabase);

  const { data: alerts, error } = await supa.from("job_alerts").select("id,user_id,label,query,last_notified_at");
  if (error) {
    console.error("Lecture des alertes échouée:", error.message);
    process.exitCode = 1;
    await prisma.$disconnect();
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
    console.log(`Aucune alerte ni jeton push.${reminderSent ? ` ${reminderSent} rappel(s) candidature.` : ""}`);
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
    const ntfy = alert.query.ntfyTopic?.trim();
    let ok = false;
    if (hook) {
      ok = await postWebhook(hook, formatJobsWebhook(label, matched), "JobCCQ");
    }
    if (ntfy) {
      const click = `${SITE_URL}/emplois`;
      if (await postNtfy(ntfy, `JobCCQ — ${label}`, formatJobsWebhook(label, matched), click)) ok = true;
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
  console.log(`Terminé : ${sent} courriel(s) · ${pushed} push · ${reminderSent} rappel(s) candidature.`);
  await notifyAdminHooks();
  await prisma.$disconnect();
}

/** Fin de scrape + sources tombées à 0 (WEBHOOK_SCRAPE_URL / NTFY_TOPIC). */
async function notifyAdminHooks(): Promise<void> {
  const hook = process.env.WEBHOOK_SCRAPE_URL?.trim();
  const ntfy = process.env.NTFY_TOPIC?.trim();
  if (!hook && !ntfy) return;
  const startedRaw = process.env.SCRAPE_STARTED_AT?.trim();
  const startedMs = startedRaw ? Date.parse(startedRaw) : NaN;
  const since = Number.isNaN(startedMs)
    ? new Date(Date.now() - 8 * HOUR)
    : new Date(startedMs - 2 * 60_000);
  const runs = await prisma.scrapeRun.findMany({
    where: { finishedAt: { gte: since } },
    orderBy: { id: "desc" },
    take: 2500,
  });
  const latest = new Map<string, (typeof runs)[number]>();
  for (const r of runs) {
    if (!latest.has(r.sourceId)) latest.set(r.sourceId, r);
  }
  const list = [...latest.values()];
  const dropped: string[] = [];
  const bySource = new Map<string, typeof runs>();
  for (const r of runs) {
    const group = bySource.get(r.sourceId) ?? [];
    group.push(r);
    bySource.set(r.sourceId, group);
  }
  for (const [id, group] of bySource) {
    const [cur, prev] = group;
    if (cur && prev && cur.found === 0 && prev.found >= 8) dropped.push(`${id} (${prev.found} → 0)`);
  }
  const employers = list.length
    ? await prisma.employer.findMany({
        where: { id: { in: list.map((r) => r.sourceId) } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = Object.fromEntries(employers.map((e) => [e.id, e.name]));
  let text = formatScrapeNtfy(
    list.map((r) => ({
      sourceId: r.sourceId,
      name: nameById[r.sourceId],
      status: r.status,
      found: r.found,
      inserted: r.inserted,
      updated: r.updated,
      error: r.error,
      diff: parseScrapeDiff(r.diffJson),
    })),
  );
  if (dropped.length) {
    text += `\n\n⚠ tombées à 0 : ${dropped.slice(0, 8).join(", ")}`;
    if (dropped.length > 8) text += ` … +${dropped.length - 8}`;
  }
  const one = list.length === 1 ? (nameById[list[0]!.sourceId] ?? list[0]!.sourceId) : null;
  const title = one ? `JobCCQ — scrape ${one}` : `JobCCQ — scrape (${list.length} sources)`;
  if (hook) {
    const sent = await postWebhook(hook, text, title);
    console.log(sent ? "Webhook scrape envoyé." : "Webhook scrape échoué.");
  }
  if (ntfy) {
    const sent = await postNtfy(ntfy, title, text, `${SITE_URL}/emplois`);
    console.log(sent ? "ntfy scrape envoyé." : "ntfy scrape échoué.");
  }
}

main().catch((err) => {
  console.error("Erreur notify:", err);
  process.exitCode = 1;
});
