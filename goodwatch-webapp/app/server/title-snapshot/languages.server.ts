// Optional original-language column in the same row order as the main title snapshot.
import { createHash } from "node:crypto"
import type { Manifest } from "./format.server"

interface LanguageManifest {
	format: 1
	chunks: number
	sha256: string
	codes: string[]
}
export interface LanguageInput {
	manifest: LanguageManifest
	chunks: Uint8Array[]
}
export interface OriginalLanguages {
	codes: readonly string[]
	indexes: Uint16Array
}

export async function readLanguageChunks(
	redis: { getBuffer(key: string): Promise<Uint8Array | null> },
	manifest: Manifest,
): Promise<LanguageInput | null> {
	if (manifest.languages == null) return null
	try {
		const side = manifest.languages as Partial<LanguageManifest>
		if (
			side.format !== 1 ||
			!Number.isSafeInteger(side.chunks) ||
			!side.chunks ||
			side.chunks < 1 ||
			side.chunks > Math.max(1, 2 * manifest.count) ||
			typeof side.sha256 !== "string" ||
			!/^[0-9a-f]{64}$/.test(side.sha256) ||
			!Array.isArray(side.codes) ||
			side.codes.length > 65535 ||
			!side.codes.every((s) => typeof s === "string" && s.length > 0) ||
			new Set(side.codes).size !== side.codes.length
		)
			throw new Error("invalid original-language manifest")
		const chunks = await Promise.all(
			Array.from({ length: side.chunks }, async (_, i) => {
				const chunk = await redis.getBuffer(`title-snapshot:${manifest.version}:languages:${i}`)
				if (!chunk) throw new Error(`missing chunk ${i}`)
				return chunk
			}),
		)
		return { manifest: side as LanguageManifest, chunks }
	} catch (error) {
		console.error(`Title snapshot ${manifest.version} loads without original languages:`, error)
		return null
	}
}

export function decodeLanguages(input: LanguageInput, count: number): OriginalLanguages {
	const { manifest, chunks } = input
	if (chunks.reduce((size, chunk) => size + chunk.byteLength, 0) !== count * 2)
		throw new Error("original-language column length differs from the catalog")
	const bytes = Buffer.concat(chunks)
	if (createHash("sha256").update(bytes).digest("hex") !== manifest.sha256)
		throw new Error("original-language checksum mismatch")
	const indexes = new Uint16Array(count)
	for (let row = 0; row < count; row++) {
		const index = bytes.readUInt16LE(row * 2)
		if (index !== 65535 && index >= manifest.codes.length)
			throw new Error("unknown original-language index")
		indexes[row] = index
	}
	return { codes: manifest.codes, indexes }
}
