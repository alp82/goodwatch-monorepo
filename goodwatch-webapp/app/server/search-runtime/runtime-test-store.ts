// Stands in for store.server.ts in runtime.test.ts: the real store can't load under `node --test` (it uses
// constructor parameter properties, and it pulls in Crate and Redis). The tests pass their own store object.
export function productionStore(): never {
	throw new Error("The test store has no production store")
}
