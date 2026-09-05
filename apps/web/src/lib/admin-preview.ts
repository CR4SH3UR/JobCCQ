import { previewFromHtml, type HtmlPreviewItem } from "@jobccq/shared";
import { API_URL, adminFetch } from "./data";
import { supabase } from "./supabase";

export type PreviewResult = {
  count: number;
  usedParseList?: boolean;
  via: "api" | "supabase";
  sample: HtmlPreviewItem[];
  html?: string;
};

/**
 * Aperçu parseur : API Fastify locale si elle tourne, sinon fonction Supabase
 * (fetch HTML sans CORS + JSON-LD/RSS dans le navigateur). C'est le même repli
 * que la liste des comptes admin.
 */
const LOCAL_API_MS = 3_000;

export async function previewEmployer(id: string, careersUrl: string): Promise<PreviewResult> {
  try {
    const r = await adminFetch(`${API_URL}/admin/employers/${encodeURIComponent(id)}/preview`, {
      method: "POST",
      signal: AbortSignal.timeout(LOCAL_API_MS),
    });
    const d = (await r.json()) as {
      error?: string;
      count?: number;
      usedParseList?: boolean;
      sample?: HtmlPreviewItem[];
    };
    if (r.ok && !d.error) {
      return {
        count: d.count ?? 0,
        usedParseList: d.usedParseList,
        via: "api",
        sample: Array.isArray(d.sample) ? d.sample : [],
      };
    }
  } catch {
    /* API locale absente (site statique / Turso) */
  }

  if (!supabase) throw new Error("API locale absente et Supabase non configuré.");
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    error?: string;
    html?: string;
    title?: string;
  }>("admin-preview", { body: { url: careersUrl } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  const html = data?.html ?? "";
  const sample = previewFromHtml(html, careersUrl);
  return { count: sample.length, via: "supabase", sample, html };
}

/** HTML brut de la page carrières (fixture), même repli API → Supabase. */
export async function fetchEmployerHtml(id: string, careersUrl: string): Promise<{ html: string; filename: string }> {
  try {
    const r = await adminFetch(`${API_URL}/admin/employers/${encodeURIComponent(id)}/fixture`, {
      signal: AbortSignal.timeout(LOCAL_API_MS),
    });
    if (r.ok) {
      const html = await r.text();
      if (html && !html.trimStart().startsWith("{")) {
        return { html, filename: `${id}.html` };
      }
    }
  } catch {
    /* repli Supabase */
  }
  if (!supabase) throw new Error("API locale absente et Supabase non configuré.");
  const { data, error } = await supabase.functions.invoke<{ html?: string; error?: string }>("admin-preview", {
    body: { url: careersUrl },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  if (!data?.html) throw new Error("HTML indisponible.");
  return { html: data.html, filename: `${id}.html` };
}
