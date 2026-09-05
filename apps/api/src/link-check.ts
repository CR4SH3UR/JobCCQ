/**
 * Sonde HTTP des liens d'offres (HEAD, repli GET). Plafonnée et parallèle
 * pour ne pas allonger trop le scrape. `LINK_CHECK=0` pour sauter.
 */
import { interpretLinkCheck, type Job, type LinkStatus } from "@jobccq/shared";
import { env } from "./env.js";

const CONCURRENCY = 6;
const TIMEOUT_MS = 8_000;

async function probeUrl(url: string): Promise<LinkStatus> {
  const ctrl = AbortSignal.timeout(TIMEOUT_MS);
  const headers = { "User-Agent": env.USER_AGENT, Accept: "*/*" };
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "manual", signal: ctrl, headers });
    if (res.status === 405 || res.status === 501 || res.status === 400) {
      res = await fetch(url, { method: "GET", redirect: "manual", signal: ctrl, headers });
    }
    return interpretLinkCheck({ status: res.status });
  } catch {
    return "unknown";
  }
}

async function poolMap<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      const item = items[idx];
      if (item) await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, Math.max(1, items.length)) }, () => worker()));
}

/** Annote `linkStatus` sur chaque offre (en place). */
export async function annotateLinkStatus(
  jobs: Job[],
  log: (m: string) => void = () => {},
): Promise<void> {
  if (process.env.LINK_CHECK === "0" || jobs.length === 0) return;
  let gone = 0;
  await poolMap(jobs, CONCURRENCY, async (job) => {
    const status = await probeUrl(job.url);
    job.linkStatus = status;
    if (status === "gone") gone += 1;
  });
  log(`liens sondés : ${jobs.length} (${gone} peut-être pourvue${gone > 1 ? "s" : ""})`);
}
