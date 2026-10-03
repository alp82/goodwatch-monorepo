// A member's taste as Redis holds it (see member.server.ts). The value is binary, about 1 KB: a 2-byte header length,
// a JSON header, padding to 4 bytes, then (with a vector) 74 float32 for the unit-length vector and one float32 per
// QUANTILE_LEVELS entry for the quantile table, little-endian.
import { QUANTILES, TASTE_LENGTH } from "./formula.server"
import type { BuiltTaste } from "./taste.server"

export interface StoredTaste extends BuiltTaste {
	wantToSee: number
	builtAt: number
	sourceAt: number
	touchedAt: number
	snapshotVersion: string
}

export function encodeTaste(taste: StoredTaste): Buffer {
	const { vector, quantiles, ...header } = taste
	const json = Buffer.from(JSON.stringify(header))
	const floatsAt = Math.ceil((2 + json.length) / 4) * 4
	const floats = vector && quantiles ? TASTE_LENGTH + QUANTILES : 0
	const buffer = Buffer.alloc(floatsAt + floats * 4)
	buffer.writeUInt16LE(json.length, 0)
	json.copy(buffer, 2)
	if (vector && quantiles) {
		vector.forEach((v, i) => buffer.writeFloatLE(v, floatsAt + i * 4))
		quantiles.forEach((v, i) =>
			buffer.writeFloatLE(v, floatsAt + (TASTE_LENGTH + i) * 4),
		)
	}
	return buffer
}

/**
 * The stored taste, or null for a value to rebuild: one that can't be read, or whose floats aren't exactly a vector
 * and a quantile table of today's length (a value written with another table).
 */
export function decodeTaste(buffer: Buffer): StoredTaste | null {
	try {
		const length = buffer.readUInt16LE(0)
		const header = JSON.parse(buffer.subarray(2, 2 + length).toString())
		const floatsAt = Math.ceil((2 + length) / 4) * 4
		const floats = (buffer.length - floatsAt) / 4
		if (floats !== 0 && floats !== TASTE_LENGTH + QUANTILES) return null
		const read = (from: number, count: number) =>
			Float32Array.from({ length: count }, (_, i) =>
				buffer.readFloatLE(floatsAt + (from + i) * 4),
			)
		return {
			...header,
			vector: floats ? read(0, TASTE_LENGTH) : null,
			quantiles: floats ? read(TASTE_LENGTH, QUANTILES) : null,
		}
	} catch (error) {
		console.error("Taste: unreadable stored taste, rebuilding:", error)
		return null
	}
}
