// PROTOTYPE - throwaway (#617). Looks inside a file in the browser without uploading it: a ZIP's file names, a CSV's
// header, an XML root element, or a JSON file's top-level keys. Recognition (recognize.ts) works from this.

export type Peek =
	| { kind: "zip"; entries: string[] }
	| { kind: "csv"; header: string[]; firstLine: string }
	| { kind: "xml"; root: string; text: string }
	| { kind: "json"; keys: string[]; isArray: boolean }
	| { kind: "unknown" }

export async function peekFile(file: File): Promise<Peek> {
	const name = file.name.toLowerCase()
	if (name.endsWith(".gz") || file.type === "application/gzip") {
		const text = await new Response(
			file.stream().pipeThrough(new DecompressionStream("gzip")),
		).text()
		return peekText(text.slice(0, 20000))
	}
	if (
		name.endsWith(".zip") ||
		["application/zip", "application/x-zip-compressed"].includes(file.type)
	)
		return { kind: "zip", entries: await zipEntries(file) }
	return peekText(await file.slice(0, 20000).text())
}

export function peekText(text: string): Peek {
	const trimmed = text.replace(/^﻿/, "").trimStart()
	if (trimmed.startsWith("<")) {
		const root = trimmed
			.replace(/<\?xml[^>]*>/, "")
			.replace(/<!--[\s\S]*?-->/g, "")
			.trimStart()
			.match(/^<([A-Za-z_][\w:-]*)/)?.[1]
		return root
			? { kind: "xml", root, text: trimmed.slice(0, 4000) }
			: { kind: "unknown" }
	}
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		const isArray = trimmed.startsWith("[")
		// The file may be cut off; the keys at the first level are enough.
		const body = isArray ? trimmed.slice(1).trimStart() : trimmed
		const keys = [...body.matchAll(/"([^"]+)"\s*:/g)].map((m) => m[1])
		return { kind: "json", keys: [...new Set(keys)].slice(0, 40), isArray }
	}
	const firstLine = trimmed.split(/\r?\n/)[0] ?? ""
	if (
		firstLine.includes(",") ||
		firstLine.includes(";") ||
		firstLine.includes("\t")
	) {
		const separator = firstLine.includes("\t")
			? "\t"
			: firstLine.includes(";") && !firstLine.includes(",")
				? ";"
				: ","
		return {
			kind: "csv",
			header: firstLine
				.split(separator)
				.map((cell) => cell.trim().replace(/^"|"$/g, "")),
			firstLine,
		}
	}
	return { kind: "unknown" }
}

// The central directory at the end of a ZIP lists every file name; nothing needs unpacking.
async function zipEntries(file: File): Promise<string[]> {
	const tailSize = Math.min(file.size, 66000)
	const tail = new DataView(
		await file.slice(file.size - tailSize).arrayBuffer(),
	)
	let end = -1
	for (let i = tail.byteLength - 22; i >= 0; i--)
		if (tail.getUint32(i, true) === 0x06054b50) {
			end = i
			break
		}
	if (end < 0) return []
	const size = tail.getUint32(end + 12, true)
	const offset = tail.getUint32(end + 16, true)
	const directory = new DataView(
		await file.slice(offset, offset + size).arrayBuffer(),
	)
	const decoder = new TextDecoder()
	const names: string[] = []
	let at = 0
	while (
		at + 46 <= directory.byteLength &&
		directory.getUint32(at, true) === 0x02014b50
	) {
		const nameLength = directory.getUint16(at + 28, true)
		const extraLength = directory.getUint16(at + 30, true)
		const commentLength = directory.getUint16(at + 32, true)
		names.push(
			decoder.decode(
				new Uint8Array(
					directory.buffer,
					directory.byteOffset + at + 46,
					nameLength,
				),
			),
		)
		at += 46 + nameLength + extraLength + commentLength
	}
	return names
}
