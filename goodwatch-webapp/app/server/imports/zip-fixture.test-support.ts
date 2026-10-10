import { deflateRawSync } from "node:zlib"

function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff
	for (const byte of bytes) {
		crc ^= byte
		for (let bit = 0; bit < 8; bit++)
			crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
	}
	return (crc ^ 0xffffffff) >>> 0
}

/** Small ZIP builder for parser seam tests. It intentionally has no production dependencies. */
export function zipFixture(
	files: Record<string, string> | Array<[string, string]>,
	options: { encrypted?: string; method?: "store" | "deflate" } = {},
): Uint8Array {
	const entries = Array.isArray(files) ? files : Object.entries(files)
	const locals: Buffer[] = []
	const directory: Buffer[] = []
	let offset = 0
	for (const [name, text] of entries) {
		const nameBytes = Buffer.from(name)
		const data = Buffer.from(text)
		const compressed = options.method === "store" ? data : deflateRawSync(data)
		const method = options.method === "store" ? 0 : 8
		const flags = 0x800 | (options.encrypted === name ? 1 : 0)
		const crc = crc32(data)
		const local = Buffer.alloc(30)
		local.writeUInt32LE(0x04034b50, 0)
		local.writeUInt16LE(20, 4)
		local.writeUInt16LE(flags, 6)
		local.writeUInt16LE(method, 8)
		local.writeUInt32LE(crc, 14)
		local.writeUInt32LE(compressed.length, 18)
		local.writeUInt32LE(data.length, 22)
		local.writeUInt16LE(nameBytes.length, 26)
		locals.push(local, nameBytes, compressed)

		const central = Buffer.alloc(46)
		central.writeUInt32LE(0x02014b50, 0)
		central.writeUInt16LE(0x0314, 4)
		central.writeUInt16LE(20, 6)
		central.writeUInt16LE(flags, 8)
		central.writeUInt16LE(method, 10)
		central.writeUInt32LE(crc, 16)
		central.writeUInt32LE(compressed.length, 20)
		central.writeUInt32LE(data.length, 24)
		central.writeUInt16LE(nameBytes.length, 28)
		central.writeUInt32LE(offset, 42)
		directory.push(central, nameBytes)
		offset += local.length + nameBytes.length + compressed.length
	}
	const directorySize = directory.reduce((sum, part) => sum + part.length, 0)
	const end = Buffer.alloc(22)
	end.writeUInt32LE(0x06054b50, 0)
	end.writeUInt16LE(entries.length, 8)
	end.writeUInt16LE(entries.length, 10)
	end.writeUInt32LE(directorySize, 12)
	end.writeUInt32LE(offset, 16)
	return Buffer.concat([...locals, ...directory, end])
}
