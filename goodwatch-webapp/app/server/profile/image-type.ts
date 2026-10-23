// A profile photo upload's checks and encoding, without storage: the type its first bytes declare (the declared content
// type is not trusted), and the re-encoding to a 512 px square WebP.

export type ImageType = "jpeg" | "png" | "webp"

/** The image type its first bytes declare; null for anything else (the declared content type is not trusted). */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
	if (
		bytes.length >= 3 &&
		bytes[0] === 0xff &&
		bytes[1] === 0xd8 &&
		bytes[2] === 0xff
	)
		return "jpeg"
	if (
		bytes.length >= 8 &&
		[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
			(b, i) => bytes[i] === b,
		)
	)
		return "png"
	if (
		bytes.length >= 12 &&
		String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
		String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
	)
		return "webp"
	return null
}

export const AVATAR_SIZE = 512

/** About a 4000 x 4000 photo: enough for any phone picture, small enough that decoding can't take much memory. */
export const AVATAR_MAX_PIXELS = 16_000_000

// One encode at a time in this process: each holds the decoded picture (up to AVATAR_MAX_PIXELS) in memory.
let encoding: Promise<unknown> = Promise.resolve()

/** Re-encodes to a 512 px square WebP. sharp drops EXIF, GPS and other metadata unless asked to keep it. */
export function encodeAvatar(bytes: Uint8Array): Promise<Buffer> {
	const run = encoding.then(() => encode(bytes))
	encoding = run.catch(() => {})
	return run
}

async function encode(bytes: Uint8Array): Promise<Buffer> {
	const { default: sharp } = await import("sharp")
	return await sharp(bytes, {
		limitInputPixels: AVATAR_MAX_PIXELS,
		failOn: "error",
	})
		.rotate() // honour the photo's orientation before its metadata goes
		.resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "attention" })
		.webp({ quality: 82, effort: 4 })
		.toBuffer()
}
