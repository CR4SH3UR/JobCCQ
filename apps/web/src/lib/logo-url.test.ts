import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { optimizedLogoUrl } from "./logo-url.js";

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
