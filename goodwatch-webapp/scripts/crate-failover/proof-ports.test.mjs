import assert from "node:assert/strict"
import { test } from "node:test"
import { firstInsertProof } from "./first-insert-proof.mjs"
import { removalRetryProof } from "./removal-retry-proof.mjs"

for (const [name, proof] of [["first insert", firstInsertProof], ["removal retry", removalRetryProof]]) {
 test(`${name} restores the isolated cluster port after a proxy scenario fails`, async (t) => {
  const previous = process.env.CRATE_PORT
  t.after(() => {
   if (previous === undefined) delete process.env.CRATE_PORT
   else process.env.CRATE_PORT = previous
  })
  process.env.CRATE_PORT = "17774"
  const failure = new Error("fixture failure after proxy setup")
  const failThroughProxy = async () => {
   assert.notEqual(process.env.CRATE_PORT, "17774", "The scenario must have switched to its proxy")
   throw failure
  }
  await assert.rejects(proof({
   endpoints: ["http://127.0.0.1:1"],
   sql: async () => ({ rows: [], rowcount: 1 }),
   setCrateClientForTest: () => {},
   check: assert.deepEqual,
   pageProof: {
    trackingAction: name === "first insert" ? failThroughProxy : async () => ({}),
    trackingFailure: failThroughProxy,
   },
  }), error => error === failure)
  assert.equal(process.env.CRATE_PORT, "17774")
 })
}
