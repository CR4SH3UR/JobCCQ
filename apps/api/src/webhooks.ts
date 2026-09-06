/**
 * Webhooks Discord / Slack (alertes utilisateur + fin de scrape / source à 0).
 */
export async function postWebhook(url: string, text: string, title?: string): Promise<boolean> {
  const target = url.trim();
  if (!/^https:\/\//i.test(target)) return false;
  const discord = /discord(?:app)?\.com\/api\/webhooks/i.test(target);
  const body = discord
    ? {
        content: title ? `**${title}**\n${text}` : text,
      }
    : { text: title ? `${title}\n${text}` : text };
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function formatJobsWebhook(label: string, jobs: { title: string; company: string; url: string }[]): string {
  const lines = jobs.slice(0, 12).map((j) => `• ${j.title} — ${j.company}\n  ${j.url}`);
  if (jobs.length > 12) lines.push(`… et ${jobs.length - 12} autre(s)`);
  return `${jobs.length} nouvelle(s) offre(s) · ${label}\n${lines.join("\n")}`;
}
