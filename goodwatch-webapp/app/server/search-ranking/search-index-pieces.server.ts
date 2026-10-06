// How a search index travels from the worker that built it to the main thread: typed arrays whole and transferred
// (no copy), arrays, maps, and sets in slices of bounded weight, so that the main thread never spends long on one
// message. The assembler touches only the arriving slice.
import type { SearchIndex } from "./search-index.server.ts"

// The most a slice weighs, unless one item alone is heavier. An item weighs 1 plus the sizes of the collections
// directly inside it. The index is about 3 million items, so a load takes on the order of a thousand messages. Smaller
// slices leave more room for a garbage collection pause in the same turn of the event loop.
export const PIECE_WEIGHT = 5_000
type Kind = "array" | "map" | "set" | "object" | "value"
export interface Piece {
	sequence: number
	path: string[]
	kind: Kind | "end"
	value?: unknown
	items?: unknown[]
	weight?: number
}

/** Count the item and the collections directly inside it, including a nested list itself. */
export function itemWeight(item: unknown): number {
	const size = (v: unknown) =>
		Array.isArray(v)
			? v.length
			: v instanceof Map || v instanceof Set
				? v.size
				: 0
	if (Array.isArray(item))
		return 1 + item.length + item.reduce((n, v) => n + size(v), 0)
	if (item instanceof Map || item instanceof Set) return 1 + item.size
	return (
		1 +
		(item && typeof item === "object"
			? Object.values(item).reduce<number>((n, v) => n + size(v), 0)
			: 0)
	)
}

export function* piecesOf(index: SearchIndex): Generator<Piece> {
	let sequence = 0
	function* walk(value: unknown, path: string[]): Generator<Piece> {
		// The manifest and timing record are small metadata objects.
		if (
			path.length === 1 &&
			(path[0] === "manifest" || path[0] === "timings")
		) {
			yield { sequence: sequence++, path, kind: "value", value }
			return
		}
		const kind: Kind = Array.isArray(value)
			? "array"
			: value instanceof Map
				? "map"
				: value instanceof Set
					? "set"
					: value &&
							typeof value === "object" &&
							!ArrayBuffer.isView(value) &&
							!(value instanceof Date)
						? "object"
						: "value"
		yield {
			sequence: sequence++,
			path,
			kind,
			...(kind === "value" ? { value } : {}),
		}
		if (kind === "object") {
			for (const [key, child] of Object.entries(value as object))
				yield* walk(child, [...path, key])
		} else if (kind !== "value") {
			let items: unknown[] = []
			let weight = 0
			for (const item of value as Iterable<unknown>) {
				const next = itemWeight(item)
				if (items.length && weight + next > PIECE_WEIGHT) {
					yield { sequence: sequence++, path, kind, items, weight }
					items = []
					weight = 0
				}
				items.push(item)
				weight += next
			}
			if (items.length)
				yield { sequence: sequence++, path, kind, items, weight }
		}
	}
	yield* walk(index, [])
	yield { sequence: sequence++, path: [], kind: "end" }
}

export function transferablesOf(piece: Piece): ArrayBuffer[] {
	return ArrayBuffer.isView(piece.value)
		? [piece.value.buffer as ArrayBuffer]
		: []
}

export function createAssembler() {
	let root: unknown
	let sequence = 0
	let complete = false
	return {
		add(piece: Piece) {
			if (complete || piece.sequence !== sequence++)
				throw new Error("Missing or out-of-order search index piece")
			if (piece.kind === "end") {
				complete = true
				return
			}
			let parent = { root } as Record<string, unknown>
			let key = "root"
			for (const part of piece.path) {
				parent = parent[key] as Record<string, unknown>
				key = part
			}
			if (piece.items) {
				const target = parent[key]
				for (const item of piece.items) {
					if (Array.isArray(target)) target.push(item)
					else if (target instanceof Map) {
						const [key, value] = item as [unknown, unknown]
						target.set(key, value)
					} else if (target instanceof Set) target.add(item)
					else throw new Error("Missing search index collection")
				}
			} else {
				parent[key] =
					piece.kind === "array"
						? []
						: piece.kind === "map"
							? new Map()
							: piece.kind === "set"
								? new Set()
								: piece.kind === "object"
									? {}
									: piece.value
				if (!piece.path.length) root = parent[key]
			}
		},
		finish(): SearchIndex {
			if (!complete) throw new Error("Missing search index pieces")
			return root as SearchIndex
		},
	}
}
