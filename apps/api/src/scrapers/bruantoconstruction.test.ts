import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBruantoConstruction } from "./bruantoconstruction.js";

const FIXTURE = `
<!DOCTYPE html>
<html lang="fr-CA">
<head><title>Menuisiers I Emploi #1 I Bruanto Construction</title></head>
<body>
  <section class="elementor-section elementor-top-section">
    <div class="elementor-container">
      <div class="elementor-column">
        <div class="elementor-widget-wrap">
          <div class="elementor-element elementor-widget elementor-widget-heading">
            <div class="elementor-widget-container">
              <h5 class="elementor-heading-title elementor-size-default">Offre d’emploi</h5>
            </div>
          </div>

          <section class="elementor-section elementor-inner-section">
            <div class="elementor-container">
              <div class="elementor-column">
                <div class="elementor-widget-wrap">
                  <div class="elementor-element elementor-widget elementor-widget-heading">
                    <div class="elementor-widget-container">
                      <p class="elementor-heading-title elementor-size-default">Compagnon et apprenti avec expérience en charpente de bois</p>
                    </div>
                  </div>
                  <div class="elementor-element elementor-widget elementor-widget-text-editor">
                    <div class="elementor-widget-container">
                      <ul>
                        <li><span class="elementor-icon-list-text">Expérience solide en charpente de bois.</span></li>
                        <li>Initiative et capacité à travailler de manière autonome.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <div class="elementor-column">
                <div class="elementor-widget-wrap">
                  <div class="elementor-element elementor-widget elementor-widget-icon">
                    <div class="elementor-widget-container">
                      <a class="elementor-icon" href="#contact"><svg></svg></a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="elementor-section elementor-inner-section">
            <div class="elementor-container">
              <div class="elementor-column">
                <div class="elementor-widget-wrap">
                  <div class="elementor-element elementor-widget elementor-widget-heading">
                    <div class="elementor-widget-container">
                      <p class="elementor-heading-title elementor-size-default">Chef d’équipe - temps plein</p>
                    </div>
                  </div>
                  <div class="elementor-element elementor-widget elementor-widget-text-editor">
                    <div class="elementor-widget-container">
                      <ul>
                        <li>Solide expérience en charpente (minimum 5 ans).</li>
                        <li>Leadership et compétences en gestion d’équipe.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="elementor-section elementor-inner-section">
            <div class="elementor-container">
              <div class="elementor-column">
                <div class="elementor-widget-wrap">
                  <div class="elementor-element elementor-widget elementor-widget-heading">
                    <div class="elementor-widget-container">
                      <p class="elementor-heading-title elementor-size-default">Postulez en ligne!</p>
                    </div>
                  </div>
                  <div class="elementor-element elementor-widget elementor-widget-icon-list">
                    <div class="elementor-widget-container">
                      <ul class="elementor-icon-list-items">
                        <li><span class="elementor-icon-list-text">+1 450 323-1160</span></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  </section>
</body>
</html>
`;

describe("parseBruantoConstruction", () => {
  it("extrait les postes depuis les sections Elementor de carrière", () => {
    const jobs = parseBruantoConstruction(FIXTURE);
    assert.equal(jobs.length, 2);

    const compagnon = jobs.find((j) =>
      j.title === "Compagnon et apprenti avec expérience en charpente de bois",
    );
    assert.ok(compagnon);
    assert.equal(compagnon!.company, "Bruanto Construction");
    assert.equal(
      compagnon!.url,
      "https://bruantoconstruction.com/carriere-menuisiers/#compagnon-et-apprenti-avec-experience-en-charpente-de-bois",
    );
    assert.match(compagnon!.description ?? "", /Expérience solide en charpente/);
    assert.equal(compagnon!.employmentType, undefined);

    const chef = jobs.find((j) => j.title === "Chef d’équipe - temps plein");
    assert.ok(chef);
    assert.equal(
      chef!.url,
      "https://bruantoconstruction.com/carriere-menuisiers/#chef-d-equipe-temps-plein",
    );
    assert.equal(chef!.employmentType, "temps-plein");
  });

  it("renvoie un tableau vide si aucune offre n'est présente", () => {
    assert.deepEqual(parseBruantoConstruction("<html><body></body></html>"), []);
  });
});
