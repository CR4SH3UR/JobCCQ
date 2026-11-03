import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES, guideBySlug } from "@/data/guides";
import { siteUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) return { title: "Guide — JobCCQc" };
  const url = siteUrl(`/guides/${slug}/`);
  return {
    title: `${guide.title} | JobCCQc`,
    description: guide.description,
    alternates: { canonical: url },
    openGraph: { title: guide.title, description: guide.description, url, type: "article" },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) notFound();

  const updated = new Date(guide.updatedAt).toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <article>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-sm text-slate-500">
            <Link href="/guides/" className="hover:text-brand-700">
              Guides carrière
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{guide.title}</h1>
          <p className="mt-2 text-slate-600">{guide.description}</p>
          <p className="mt-2 text-xs text-slate-400">Mis à jour le {updated}</p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        {guide.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lg font-semibold text-slate-900">{s.heading}</h2>
            {s.paragraphs.map((p) => (
              <p key={p.slice(0, 40)} className="mt-2 text-slate-700 leading-relaxed">
                {p}
              </p>
            ))}
            {s.bullets && s.bullets.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">
                {s.bullets.map((b) => (
                  <li key={b.slice(0, 40)}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {guide.related && guide.related.length > 0 && (
          <nav className="border-t border-slate-200 pt-6">
            <h2 className="text-sm font-semibold text-slate-700">Voir aussi</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {guide.related.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 hover:border-brand-300 hover:text-brand-700"
                  >
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <p className="text-xs text-slate-400">
          Contenu informatif indépendant. JobCCQc n&apos;est pas affilié à la CCQ. Vérifiez toujours
          les règles officielles sur{" "}
          <a
            href="https://www.ccq.org/"
            className="underline hover:text-brand-700"
            rel="noopener noreferrer"
            target="_blank"
          >
            ccq.org
          </a>
          .
        </p>
      </div>
    </article>
  );
}
