import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CCQ_TRADES, ccqTradeById, ccqTradeOf } from "./ccq.js";

describe("CCQ_TRADES — manœuvre", () => {
  it("figure dans la liste (profil, autocomplétion, pages métier)", () => {
    assert.ok(CCQ_TRADES.some((t) => t.id === "manoeuvre"));
    assert.ok(CCQ_TRADES.some((t) => t.id === "manoeuvre-specialise"));
    assert.ok(CCQ_TRADES.some((t) => t.id === "contremaitre"));
    assert.equal(ccqTradeById("manoeuvre")?.label, "Manœuvre");
    assert.equal(ccqTradeById("manoeuvre-specialise")?.label, "Manœuvre spécialisé");
  });

  it("détecte Manœuvre et Manœuvre spécialisé sans les confondre", () => {
    assert.equal(ccqTradeOf("Manoeuvre")?.id, "manoeuvre");
    assert.equal(ccqTradeOf("Manœuvre de chantier")?.id, "manoeuvre");
    assert.equal(ccqTradeOf("Manoeuvre Specialisé")?.id, "manoeuvre-specialise");
    assert.equal(ccqTradeOf("Manœuvre spécialisée en coffrage")?.id, "manoeuvre-specialise");
    assert.equal(ccqTradeOf("CONTREMAITRE")?.id, "contremaitre");
    assert.equal(ccqTradeOf("Contremaître de chantier")?.id, "contremaitre");
  });
});
