import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeRawJob } from "./normalize.js";
import type { RawJob } from "@jobccq/shared";

const raw = (over: Partial<RawJob> = {}): RawJob => ({
  sourceId: "src",
  url: `https://ex.ca/${encodeURIComponent(over.title ?? "poste")}`,
  title: "Électricien",
  company: "Entreprise",
  tags: [],
  ...over,
});

describe("normalizeRawJob — salaire « selon la CCQ »", () => {
  it("pose le taux CCQ compagnon quand le métier en a un et qu'aucun salaire n'est donné", () => {
    const job = normalizeRawJob(raw({ description: "Beau poste. Salaire selon les taux de la CCQ." }));
    assert.equal(job.salaryPeriod, "heure");
    assert.ok(job.salaryMin && job.salaryMin > 0, "un taux horaire est posé");
    assert.equal(job.salaryMin, job.salaryMax, "taux unique (min = max)");
  });

  it("reconnaît « convention de la C.C.Q. » (ponctuation/espaces)", () => {
    const job = normalizeRawJob(raw({ title: "Charpentier-menuisier", description: "Rémunération selon la convention de la C.C.Q." }));
    assert.equal(job.salaryPeriod, "heure");
    assert.ok(job.salaryMin, "taux posé");
  });

  it("n'invente rien pour un métier sans taux CCQ unique (contremaître)", () => {
    const job = normalizeRawJob(
      raw({ title: "Contremaitre de chantier – travaux civil", description: "Ce qui est offert : - Salaire selon les taux de la CCQ." }),
    );
    assert.equal(job.salaryMin, undefined);
    assert.equal(job.salaryMax, undefined);
  });

  it("ne se déclenche pas hors contexte salaire (« vacances selon la CCQ »)", () => {
    const job = normalizeRawJob(raw({ description: "Vacances selon les conditions de la CCQ." }));
    assert.equal(job.salaryMin, undefined);
  });

  it("laisse la priorité au salaire explicite", () => {
    const job = normalizeRawJob(raw({ description: "Salaire 30 $/h, aussi selon la CCQ." }));
    assert.equal(job.salaryMin, 30);
  });
});

describe("normalizeRawJob — description structurée", () => {
  it("préserve les sauts de ligne (mise en forme des scrapers)", () => {
    const job = normalizeRawJob(
      raw({ description: "Tes responsabilités :\n- Superviser le chantier.\n- Mobiliser l'équipe." }),
    );
    assert.ok(job.description?.includes("\n"), "les retours à la ligne sont conservés");
    assert.ok(job.description?.includes("- Superviser"), "les puces restent");
  });

  it("compacte les blancs intra-ligne et les lignes vides multiples", () => {
    const job = normalizeRawJob(raw({ description: "Titre  :   \n\n\n\nTexte   espacé" }));
    assert.ok(!/\n{3,}/.test(job.description!), "au plus une ligne vide consécutive");
    assert.ok(!/ {2,}/.test(job.description!), "pas d'espaces doubles intra-ligne");
  });
});
