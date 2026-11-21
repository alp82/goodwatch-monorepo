// PROTOTYPE - throwaway (prototype/explore-r5). The variants' server loaders, found by file name:
// `slots/<slot>/<variant>.server.ts` exports `load`. Other `.server.ts` files in a slot folder are helpers.
import type { SlotLoader } from "./contract"

const loaders = import.meta.glob<{ load?: SlotLoader }>(
	["./slots/*/*.server.ts", "!./slots/*/*.test.ts"],
	{ eager: true },
)

const byId = new Map<string, SlotLoader>()
for (const [path, m] of Object.entries(loaders)) {
	if (!m.load) continue
	const [slot, file] = (path.split("/slots/")[1] ?? "").split("/")
	byId.set(`${slot}/${file.replace(/\.server\.ts$/, "")}`, m.load)
}

export const loaderOf = (slot: string, variant: string) => byId.get(`${slot}/${variant}`)
