import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterUsers,
  formatRelativeDate,
  paginate,
  sortUsers,
  type AdminUserRow,
} from "./admin-users-table.js";

const now = Date.parse("2026-09-06T20:00:00.000Z");

function u(over: Partial<AdminUserRow> & Pick<AdminUserRow, "email">): AdminUserRow {
  return {
    id: over.id ?? over.email,
    createdAt: over.createdAt ?? "2026-01-01T00:00:00.000Z",
    lastSignInAt: over.lastSignInAt ?? null,
    confirmedAt: over.confirmedAt ?? null,
    providers: over.providers ?? ["email"],
    ...over,
  };
}

describe("admin-users-table", () => {
  it("filtre admins, jamais connectés et recherche", () => {
    const users = [
      u({ email: "boss@job.cc", lastSignInAt: "2026-09-05T00:00:00.000Z", confirmedAt: "2026-01-01T00:00:00.000Z" }),
      u({ email: "marie@hamel.ca", lastSignInAt: null, confirmedAt: null }),
      u({
        email: "vieux@hamel.ca",
        lastSignInAt: "2025-01-01T00:00:00.000Z",
        confirmedAt: "2025-01-01T00:00:00.000Z",
      }),
    ];
    const isAdmin = (e: string) => e === "boss@job.cc";
    assert.equal(filterUsers(users, "admin", "", isAdmin, now).length, 1);
    assert.equal(filterUsers(users, "never", "", isAdmin, now)[0]?.email, "marie@hamel.ca");
    assert.equal(filterUsers(users, "confirmed", "", isAdmin, now).length, 2);
    assert.equal(filterUsers(users, "unconfirmed", "", isAdmin, now).length, 1);
    assert.equal(filterUsers(users, "recent", "", isAdmin, now)[0]?.email, "boss@job.cc");
    assert.equal(filterUsers(users, "all", "hamel", isAdmin, now).length, 2);
  });

  it("trie par courriel et paginé", () => {
    const users = [u({ email: "z@x.ca" }), u({ email: "a@x.ca" }), u({ email: "m@x.ca" })];
    assert.deepEqual(
      sortUsers(users, "email", "asc").map((x) => x.email),
      ["a@x.ca", "m@x.ca", "z@x.ca"],
    );
    assert.deepEqual(
      paginate(sortUsers(users, "email", "asc"), 2, 2).map((x) => x.email),
      ["z@x.ca"],
    );
  });

  it("affiche une date relative", () => {
    assert.equal(formatRelativeDate(null, now), "jamais");
    assert.equal(formatRelativeDate("2026-09-06T19:00:00.000Z", now), "il y a 1 h");
    assert.equal(formatRelativeDate("2026-09-05T20:00:00.000Z", now), "hier");
  });

  it("trie les visites absentes en dernier (desc)", () => {
    const users = [
      u({ email: "jamais@x.ca", lastSignInAt: null }),
      u({ email: "hier@x.ca", lastSignInAt: "2026-09-05T00:00:00.000Z" }),
    ];
    assert.deepEqual(
      sortUsers(users, "lastSignInAt", "desc").map((x) => x.email),
      ["hier@x.ca", "jamais@x.ca"],
    );
  });
});
