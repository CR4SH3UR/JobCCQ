import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCanInspec } from "./caninspec.js";

const FIXTURE = `
<!DOCTYPE html>
<html lang="fr">
<head><title>Emplois | Can-Inspec</title></head>
<body>
  <section>
    <h2>Postes offerts</h2>
    <h3>Technicien.ne</h3>
    <p>Tu as de l’expérience en inspection télévisée, en nettoyage ou en hydro-excavation ? Mets ton expertise à profit et joins-toi à notre équipe passionnée.</p>
    <h3>Aide opérateur.trice</h3>
    <p>Tu veux évoluer dans un domaine qui bouge, qui est stimulant, concret et spécialisé ? Viens apprendre, et bâtir ta carrière avec nous.</p>
    <h3>Postes administratifs</h3>
    <p>Tu fais preuve de rigueur et d’un excellent sens des priorités ? Envoie-nous ta candidature spontanée pour des postes d’adjoint.e, de chargé.e de projets ou à la direction.</p>
  </section>
</body>
</html>
`;

describe("parseCanInspec", () => {
  it("extrait les trois postes de la section Postes offerts", () => {
    const jobs = parseCanInspec(FIXTURE);
    assert.equal(jobs.length, 3);

    const technicien = jobs.find((j) => j.title === "Technicien.ne");
    assert.ok(technicien);
    assert.equal(technicien!.company, "Can-Inspec inc.");
    assert.equal(technicien!.url, "https://can-inspec.ca/#technicien-ne");
    assert.equal(
      technicien!.description,
      "Tu as de l’expérience en inspection télévisée, en nettoyage ou en hydro-excavation ? Mets ton expertise à profit et joins-toi à notre équipe passionnée.",
    );

    const aide = jobs.find((j) => j.title === "Aide opérateur.trice");
    assert.ok(aide);
    assert.equal(aide!.url, "https://can-inspec.ca/#aide-operateur-trice");

    const admin = jobs.find((j) => j.title === "Postes administratifs");
    assert.ok(admin);
    assert.equal(admin!.url, "https://can-inspec.ca/#postes-administratifs");
  });

  it("renvoie un tableau vide si la section Postes offerts est absente", () => {
    assert.deepEqual(parseCanInspec("<html><body></body></html>"), []);
  });
});
