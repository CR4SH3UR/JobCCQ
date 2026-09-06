import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  faviconForHost,
  hostFromUrl,
  isGenericLogoHost,
  optimizedLogoUrl,
  resolveCompanyLogoUrl,
} from "./logo-url.js";

describe("hostFromUrl + favicon", () => {
  it("normalise le hôte sans www", () => {
    assert.equal(hostFromUrl("https://www.HamelConstruction.com/carrieres"), "hamelconstruction.com");
    assert.equal(hostFromUrl("pas une url"), null);
  });

  it("ignore les ATS et donne un favicon DuckDuckGo sinon", () => {
    assert.equal(isGenericLogoHost("boards.greenhouse.io"), true);
    assert.equal(faviconForHost("jobillico.com"), undefined);
    assert.equal(
      faviconForHost("hamelconstruction.com"),
      "https://icons.duckduckgo.com/ip3/hamelconstruction.com.ico",
    );
  });

  it("préfère le logo d'offre au favicon", () => {
    assert.equal(
      resolveCompanyLogoUrl({
        logoUrl: "https://cdn.example.com/logo.png",
        homepage: "https://hamelconstruction.com",
      }),
      "https://cdn.example.com/logo.png",
    );
    assert.equal(
      resolveCompanyLogoUrl({ homepage: "https://www.hamelconstruction.com/" }),
      "https://icons.duckduckgo.com/ip3/hamelconstruction.com.ico",
    );
    assert.equal(resolveCompanyLogoUrl({ homepage: "https://jobillico.com/foo" }), undefined);
    assert.equal(
      resolveCompanyLogoUrl({
        homepage: "https://boards.greenhouse.io/acme",
        careersUrl: "https://www.hamelconstruction.com/carrieres",
      }),
      "https://icons.duckduckgo.com/ip3/hamelconstruction.com.ico",
    );
    assert.equal(faviconForHost("acme.myworkdayjobs.com"), undefined);
  });
});

describe("optimizedLogoUrl", () => {
  it("passe les logos externes par images.weserv.nl en WebP redimensionné et caché", () => {
    const out = optimizedLogoUrl("https://cdn.example.com/logo.png?x=1", 88);
    assert.equal(
      out,
      "https://images.weserv.nl/?url=cdn.example.com%2Flogo.png%3Fx%3D1&w=88&h=88&fit=contain&output=webp&maxage=31d",
    );
  });

  it("laisse les URLs locales et data URI inchangées", () => {
    assert.equal(optimizedLogoUrl("/logo.svg", 88), "/logo.svg");
    assert.equal(optimizedLogoUrl("data:image/svg+xml;base64,abc", 88), "data:image/svg+xml;base64,abc");
  });
});
