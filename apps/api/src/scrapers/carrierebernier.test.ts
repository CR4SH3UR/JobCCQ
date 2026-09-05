import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCarriereBernier } from "./carrierebernier.js";

const BASE = "https://www.carrierebernier.com/emplois/";

/** Extrait représentatif de la page « Emplois » (accordéon WordPress). */
const FIXTURE = `<html><body>
  <h2>Postes disponibles</h2>
  <a href=""href="" data-leid="0" class="toggle box0"><h2>Chauffeur Classe 1 ou 3</h2></a>
  <div class='toggle-box' id='toggle-box-0'>
    <p>Depuis plus de 140 ans, Carrière Bernier Ltée s&rsquo;impose comme une référence.</p>
    <p>Nous sommes à la recherche d&rsquo;un chauffeur classe 1 ou 3 afin de compléter notre équipe.</p>
    <p>Description du poste :</p>
    <p>Veuillez nous envoyer votre CV en cliquant ci-dessous.</p>
    <p><a href="mailto:rh@carrierebernier.com">POSTULER ICI</a></p>
  </div>
  <a href=""href="" data-leid="8" class="toggle box8"><h2>Poseur</h2></a>
  <div class='toggle-box' id='toggle-box-8'>
    <p>Depuis plus de 140 ans, Carrière Bernier Ltée s&rsquo;impose comme une référence.</p>
    <p>Nous sommes à la recherche d&rsquo;un poseur d&rsquo;asphalte.</p>
    <p>Veuillez nous envoyer votre CV en cliquant ci-dessous.</p>
    <p><a href="mailto:rh@carrierebernier.com">POSTULER ICI</a></p>
  </div>
  <h2>Candidatures spontanées</h2>
  <p>Envoyez-nous votre candidature.</p>
</body></html>`;

describe("parseCarriereBernier", () => {
  it("extrait une offre par accordéon (et ignore les sections hors toggle)", () => {
    const jobs = parseCarriereBernier(FIXTURE, BASE);
    assert.equal(jobs.length, 2);

    const chauffeur = jobs[0]!;
    assert.equal(chauffeur.title, "Chauffeur Classe 1 ou 3");
    assert.equal(chauffeur.company, "Carrière Bernier Ltée");
    assert.equal(chauffeur.sourceId, "carrierebernier-com");
    assert.equal(chauffeur.url, "https://www.carrierebernier.com/emplois/#chauffeur-classe-1-ou-3");
    // Résumé = la ligne « à la recherche… », pas le préambule ni le lien POSTULER.
    assert.match(chauffeur.description ?? "", /à la recherche d’un chauffeur/);

    assert.equal(jobs[1]!.title, "Poseur");
    assert.equal(jobs[1]!.url, "https://www.carrierebernier.com/emplois/#poseur");
  });

  it("dédoublonne les ancres identiques", () => {
    const dup = `<a class="toggle box0"><h2>Poseur</h2></a>
      <a class="toggle box1"><h2>Poseur</h2></a>`;
    assert.equal(parseCarriereBernier(dup, BASE).length, 1);
  });

  it("renvoie [] si aucune offre", () => {
    assert.deepEqual(parseCarriereBernier("<html><body></body></html>", BASE), []);
  });
});
