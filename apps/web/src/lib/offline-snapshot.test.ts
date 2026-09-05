import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchWithOfflineFallback } from "./offline-snapshot.js";

describe("fetchWithOfflineFallback", () => {
  it("écrit le cache après un chargement réseau", async () => {
    const written: number[] = [];
    const got = await fetchWithOfflineFallback({
      live: async () => [1, 2, 3],
      readCache: async () => null,
      writeCache: async (data) => {
        written.push(...data);
      },
    });
    assert.equal(got.fromCache, false);
    assert.deepEqual(got.data, [1, 2, 3]);
    assert.deepEqual(written, [1, 2, 3]);
  });

  it("sert le cache si le réseau échoue", async () => {
    const got = await fetchWithOfflineFallback({
      live: async () => {
        throw new Error("offline");
      },
      readCache: async () => ({ data: ["cached"], savedAt: "2026-09-05T12:00:00.000Z" }),
      writeCache: async () => {
        throw new Error("should not write");
      },
    });
    assert.equal(got.fromCache, true);
    assert.deepEqual(got.data, ["cached"]);
    assert.equal(got.savedAt, "2026-09-05T12:00:00.000Z");
  });

  it("relance l'erreur s'il n'y a ni réseau ni cache", async () => {
    await assert.rejects(
      () =>
        fetchWithOfflineFallback({
          live: async () => {
            throw new Error("offline");
          },
          readCache: async () => null,
          writeCache: async () => {},
        }),
      /offline/,
    );
  });
});
