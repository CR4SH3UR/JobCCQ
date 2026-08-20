export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">
        <p className="font-semibold text-slate-700">
          Job<span className="text-brand-600">CCQ</span>
        </p>
        <p className="mt-1 max-w-xl">
          Agrégateur d'offres d'emploi du Québec et du Canada. Les offres proviennent de sources
          tierces et appartiennent à leurs éditeurs respectifs.
        </p>
        <p className="mt-3 text-xs text-slate-400">
          © {new Date().getFullYear()} JobCCQ — projet de démonstration.
        </p>
      </div>
    </footer>
  );
}
