import { cn } from "@/lib/format";

type Tone = "slate" | "brand" | "green" | "amber" | "violet";

const TONES: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-500/25 dark:text-brand-100",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-500/25 dark:text-violet-200",
};

export function Badge({
  children,
  tone = "slate",
  className,
  title,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
