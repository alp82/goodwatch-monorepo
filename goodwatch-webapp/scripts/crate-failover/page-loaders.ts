// The real Remix route boundaries. The proof bundles only their loaders/actions; it does not render or test UI.
export { loader as movie } from "../../app/routes/movie.$movieKey.tsx"
export { loader as show } from "../../app/routes/show.$showKey.tsx"
export { loader as person } from "../../app/routes/person.$personKey.tsx"
export { loader as library } from "../../app/routes/api.my-library.ts"
export { loader as explore } from "../../app/routes/api.explorer.world.ts"
export { action as watch } from "../../app/routes/api.watch-log.ts"
export { action as tracking } from "../../app/routes/api.tracking.show.ts"
export { action as score } from "../../app/routes/api.update-scores.tsx"
export { searchQuery as catalog } from "../../app/server/combined-search/catalog.server.ts"
import {
	encodeSnapshot,
	joinChunks,
} from "../../app/server/title-snapshot/format.server.ts"
import { buildSnapshot } from "../../app/server/title-snapshot/snapshot.server.ts"
export { VALID_FINGERPRINT_KEYS } from "../../app/server/utils/fingerprint.ts"
import { VALID_FINGERPRINT_KEYS } from "../../app/server/utils/fingerprint.ts"
export function makeSnapshot() {
	const encoded = encodeSnapshot({
		version: "local-crate-fault-proof",
		builtAt: new Date(),
		keyOrder: VALID_FINGERPRINT_KEYS,
		rows: [1e12, 2e12].flatMap((base) =>
			Array.from({ length: 12 }, (_, i) => ({
				pointId: base + i + 1,
				genres: ["comedy"],
				releaseDay: 19000,
				votes: 20000,
				popularity: 2,
				fingerprint: new Uint8Array(74).fill(5),
				score: 80,
				origin: "US",
				hasPoster: true,
				hasBackdrop: true,
				adult: false,
				anime: false,
			})),
		),
	})
	Object.assign(globalThis, {
		crateProofSnapshot: buildSnapshot(
			encoded.manifest,
			joinChunks(encoded.manifest, encoded.chunks),
		),
	})
}
