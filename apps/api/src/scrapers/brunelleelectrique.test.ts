import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBrunelleElectrique } from "./brunelleelectrique.js";

const FIXTURE = `
<!DOCTYPE html>
<html lang="fr-CA">
<head><title>CARRIERES</title></head>
<body>
  <section>
    <div data-ux="Container">
      <h2>CARRIÈRES</h2>
      <p>
        <a href="http://subscribepage.io/ba9H7N">CHARGÉ(E) DE PROJETS</a>
      </p>
      <p>---</p>
      <p>
        <a href="https://bit.ly/Brunelle-Electrique-Electricien-Compagnon ">
          ÉLECTRICIEN(NE) COMPAGNON(NE) – CAMION DE SERVICE/CONTREMAÎTRE
        </a>
      </p>
      <p>---</p>
      <p>
        <a href="https://bit.ly/Brunelle-Electrique-Apprenti-Electricien">APPRENTI ÉLECTRICIEN</a>
      </p>
      <p>
        <a href="/chargé-de-projets">CHARGÉ(E) DE PROJETS</a>
      </p>
      <p>
        <a>ÉLECTRICIEN(NE) COMPAGNON(NE)</a>
      </p>
    </div>
  </section>
</body>
</html>
`;

const BASE_URL = "https://brunelleelectrique.com/carrieres";

describe("parseBrunelleElectrique", () => {
  it("extrait les postes et normalise les liens externes, relatifs ou absents", () => {
    const jobs = parseBrunelleElectrique(FIXTURE, BASE_URL);
    assert.equal(jobs.length, 5);

    const charge = jobs.find((j) => j.title === "CHARGÉ(E) DE PROJETS");
    assert.ok(charge);
    assert.equal(charge!.company, "Brunelle Électrique inc.");
    assert.equal(charge!.url, "http://subscribepage.io/ba9H7N");

    const electricien = jobs.find((j) =>
      j.title.includes("ÉLECTRICIEN(NE) COMPAGNON(NE) – CAMION DE SERVICE/CONTREMAÎTRE"),
    );
    assert.ok(electricien);
    assert.equal(
      electricien!.url,
      "https://bit.ly/Brunelle-Electrique-Electricien-Compagnon",
    );

    const apprenti = jobs.find((j) => j.title === "APPRENTI ÉLECTRICIEN");
    assert.ok(apprenti);
    assert.equal(
      apprenti!.url,
      "https://bit.ly/Brunelle-Electrique-Apprenti-Electricien",
    );

    const rel = jobs.find((j) => j.url === "https://brunelleelectrique.com/charg%C3%A9-de-projets");
    assert.ok(rel);
    assert.equal(rel!.title, "CHARGÉ(E) DE PROJETS");

    const missing = jobs.find((j) => j.url === `${BASE_URL}#electricien-ne-compagnon-ne`);
    assert.ok(missing);
    assert.equal(missing!.title, "ÉLECTRICIEN(NE) COMPAGNON(NE)");
  });

  it("renvoie un tableau vide si aucune section carrière n'est présente", () => {
    assert.deepEqual(
      parseBrunelleElectrique("<html><body><p>Aucune offre.</p></body></html>", BASE_URL),
      [],
    );
  });
});
