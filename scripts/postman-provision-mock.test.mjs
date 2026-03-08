import assert from "node:assert/strict";
import test from "node:test";

import { buildNameCandidates, resolveEntityByIdOrName } from "./postman-provision-mock.mjs";

test("buildNameCandidates returns the current normalized name only", () => {
  assert.deepEqual(buildNameCandidates(" Board Enthusiasts API (Contract Tests) "), [
    "Board Enthusiasts API (Contract Tests)"
  ]);
});

test("resolveEntityByIdOrName resolves the renamed workspace entity by exact name", () => {
  const collections = [
    { id: "1", name: "Board Enthusiasts API (Contract Tests)", uid: "owner-1" },
    { id: "2", name: "Other Collection", uid: "owner-2" }
  ];

  const result = resolveEntityByIdOrName(collections, "", "Board Enthusiasts API (Contract Tests)");

  assert.equal(result.entity?.uid, "owner-1");
});

test("resolveEntityByIdOrName prefers explicit Postman ids over name matching", () => {
  const collections = [
    { id: "1", name: "Board Enthusiasts API (Alternate)", uid: "owner-1" },
    { id: "2", name: "Board Enthusiasts API (Contract Tests)", uid: "owner-2" }
  ];

  const result = resolveEntityByIdOrName(collections, "1", "Board Enthusiasts API (Contract Tests)");

  assert.equal(result.entity?.uid, "owner-1");
});
