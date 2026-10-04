import { readFile, readdir, rm, writeFile } from "node:fs/promises"
import { availableParallelism } from "node:os"
import { extname, join, relative, resolve, sep } from "node:path"
import { promisify } from "node:util"
import { constants, brotliCompress, gzip } from "node:zlib"

const brotli = promisify(brotliCompress)
const gz = promisify(gzip)
const textTypes = new Set(
	"js mjs css html svg json map webmanifest xml txt".split(" "),
)
const compressible = new Set([...textTypes, "ttf", "otf", "ico", "wasm"])

async function main() {
	const started = performance.now()
	const directory = resolve(process.argv[2] ?? "build/client")
	const entries = await readdir(directory, {
		recursive: true,
		withFileTypes: true,
	})
	const files = entries.filter((entry) => {
		const path = relative(directory, join(entry.parentPath, entry.name))
		return (
			entry.isFile() &&
			!path.split(sep).some((part) => part.startsWith(".")) &&
			compressible.has(extname(entry.name).slice(1).toLowerCase())
		)
	})
	let next = 0
	let compressed = 0
	let originalBytes = 0
	let brotliBytes = 0
	let gzipBytes = 0
	await Promise.all(
		Array.from(
			{ length: Math.min(availableParallelism(), files.length) },
			async () => {
				while (next < files.length) {
					const entry = files[next++]
					const path = join(entry.parentPath, entry.name)
					const body = await readFile(path)
					const br = await brotli(body, {
						params: {
							[constants.BROTLI_PARAM_QUALITY]: 11,
							[constants.BROTLI_PARAM_SIZE_HINT]: body.length,
							[constants.BROTLI_PARAM_MODE]: textTypes.has(
								extname(path).slice(1).toLowerCase(),
							)
								? constants.BROTLI_MODE_TEXT
								: constants.BROTLI_MODE_GENERIC,
						},
					})
					const gzip = await gz(body, { level: 9 })
					for (const [suffix, variant] of [
						["br", br],
						["gz", gzip],
					]) {
						if (variant.length < body.length)
							await writeFile(`${path}.${suffix}`, variant)
						else await rm(`${path}.${suffix}`, { force: true })
					}
					if (br.length < body.length || gzip.length < body.length) compressed++
					originalBytes += body.length
					brotliBytes += br.length < body.length ? br.length : 0
					gzipBytes += gzip.length < body.length ? gzip.length : 0
				}
			},
		),
	)
	console.info(
		`Precompressed ${compressed} files: original ${originalBytes} bytes, Brotli ${brotliBytes} bytes, gzip ${gzipBytes} bytes, ${Math.round(performance.now() - started)} ms`,
	)
}

main().catch((error) => {
	console.error(error)
	process.exitCode = 1
})
