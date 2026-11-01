import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BAN_PERMANENT,
  banDurationFromHours,
  clientIpFromHeaders,
  formatGeo,
  isPrivateIp,
  parseGeo,
} from "./user-admin.js";

describe("banDurationFromHours", () => {
  it("permanent par défaut / valeurs non positives", () => {
    assert.equal(banDurationFromHours(), BAN_PERMANENT);
    assert.equal(banDurationFromHours(0), BAN_PERMANENT);
    assert.equal(banDurationFromHours(-5), BAN_PERMANENT);
    assert.equal(banDurationFromHours(null), BAN_PERMANENT);
  });
  it("durée en heures", () => {
    assert.equal(banDurationFromHours(24), "24h");
    assert.equal(banDurationFromHours(168), "168h");
  });
});

describe("clientIpFromHeaders", () => {
  it("prend la première IP de x-forwarded-for", () => {
    assert.equal(clientIpFromHeaders({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }), "203.0.113.9");
  });
  it("repli sur x-real-ip puis socket", () => {
    assert.equal(clientIpFromHeaders({ "x-real-ip": "198.51.100.2" }), "198.51.100.2");
    assert.equal(clientIpFromHeaders({}, "192.0.2.5"), "192.0.2.5");
  });
  it("démappe l'IPv4-sur-IPv6", () => {
    assert.equal(clientIpFromHeaders({}, "::ffff:203.0.113.7"), "203.0.113.7");
  });
  it("undefined si rien", () => {
    assert.equal(clientIpFromHeaders({}), undefined);
  });
});

describe("isPrivateIp", () => {
  it("détecte local / privé", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.16.0.1", "::1", undefined]) {
      assert.equal(isPrivateIp(ip), true, `${ip}`);
    }
  });
  it("laisse passer les IP publiques", () => {
    assert.equal(isPrivateIp("203.0.113.9"), false);
    assert.equal(isPrivateIp("8.8.8.8"), false);
  });
});

describe("parseGeo", () => {
  it("normalise une réponse ipwho.is", () => {
    const g = parseGeo({ success: true, country: "Canada", country_code: "CA", region: "Québec", city: "Montréal" });
    assert.deepEqual(g, { country: "Canada", countryCode: "CA", region: "Québec", city: "Montréal" });
  });
  it("gère ip-api (status/regionName)", () => {
    const g = parseGeo({ status: "success", country: "Canada", regionName: "Quebec", city: "Laval" });
    assert.equal(g?.region, "Quebec");
    assert.equal(g?.city, "Laval");
  });
  it("null sur échec explicite ou vide", () => {
    assert.equal(parseGeo({ success: false }), null);
    assert.equal(parseGeo({ status: "fail" }), null);
    assert.equal(parseGeo({}), null);
    assert.equal(parseGeo(null), null);
  });
});

describe("formatGeo", () => {
  it("assemble ville, région, pays", () => {
    assert.equal(formatGeo({ city: "Montréal", region: "Québec", country: "Canada" }), "Montréal, Québec, Canada");
  });
  it("ignore les segments vides et dédoublonne", () => {
    assert.equal(formatGeo({ city: "", region: "Québec", country: "Canada" }), "Québec, Canada");
    assert.equal(formatGeo(null), "");
  });
});
