import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withFetchErrorSignal } from "./http.js";

describe("withFetchErrorSignal", () => {
  it("signale un succès (undefined) sans erreur", async () => {
    const settled: (string | undefined)[] = [];
    const wrapped = withFetchErrorSignal(async () => "<html>ok</html>", (m) => settled.push(m));
    const html = await wrapped("https://exemple.test/");
    assert.equal(html, "<html>ok</html>");
    assert.deepEqual(settled, [undefined]);
  });

  it("signale l'échec (403/404) puis relance l'erreur", async () => {
    let last: string | undefined = "sentinelle";
    const wrapped = withFetchErrorSignal(
      async () => {
        throw new Error("HTTP 403 sur https://exemple.test/carrieres");
      },
      (m) => (last = m),
    );
    // Même si un appelant « avale » l'erreur (catch → return []), le signal a
    // déjà été émis : l'orchestrateur pourra marquer la source en échec.
    let swallowed: string[] = ["x"];
    try {
      await wrapped("https://exemple.test/carrieres");
    } catch {
      swallowed = []; // le scraper renvoie [] par résilience
    }
    assert.deepEqual(swallowed, []);
    assert.match(last ?? "", /HTTP 403/);
  });

  it("efface l'erreur si un fetch ultérieur réussit (repli Zoho RSS→JSON)", async () => {
    let last: string | undefined = "init";
    let call = 0;
    const wrapped = withFetchErrorSignal(
      async () => {
        call++;
        if (call === 1) throw new Error("HTTP 403 RSS"); // le flux RSS échoue
        return "<html>json</html>"; // repli JSON réussit
      },
      (m) => (last = m),
    );
    await assert.rejects(() => wrapped("https://exemple.test/rss")); // 1er appel : échec
    assert.match(last ?? "", /403/);
    await wrapped("https://exemple.test/careers"); // 2e appel : succès → efface
    assert.equal(last, undefined);
  });

  it("normalise une valeur lancée non-Error en chaîne", async () => {
    let last: string | undefined;
    const wrapped = withFetchErrorSignal(
      async () => {
        throw "coupure réseau";
      },
      (m) => (last = m),
    );
    await assert.rejects(() => wrapped("https://exemple.test/"));
    assert.equal(last, "coupure réseau");
  });
});
