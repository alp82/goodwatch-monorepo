import assert from "node:assert/strict"
import { test } from "node:test"
import { sniffImageType } from "./image-type.ts"

test("the image type comes from the first bytes, not the name or content type", () => {
	assert.equal(
		sniffImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])),
		"jpeg",
	)
	assert.equal(
		sniffImageType(
			Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
		),
		"png",
	)
	const webp = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ")
	assert.equal(sniffImageType(webp), "webp")
	assert.equal(sniffImageType(new TextEncoder().encode("<svg xmlns=...")), null)
	assert.equal(sniffImageType(new TextEncoder().encode("GIF89a")), null)
	assert.equal(sniffImageType(new Uint8Array()), null)
})

test("a photo is re-encoded to a 512 px square WebP without its metadata", async () => {
	const { default: sharp } = await import("sharp")
	const { encodeAvatar } = await import("./image-type.ts")
	const jpeg = await sharp({
		create: { width: 900, height: 600, channels: 3, background: "#c33" },
	})
		.jpeg()
		.withMetadata({ exif: { IFD0: { Copyright: "secret place" } } })
		.toBuffer()
	assert.ok((await sharp(jpeg).metadata()).exif, "the test photo carries EXIF")
	const out = await encodeAvatar(jpeg)
	const meta = await sharp(out).metadata()
	assert.equal(meta.format, "webp")
	assert.equal(meta.width, 512)
	assert.equal(meta.height, 512)
	assert.equal(meta.exif, undefined)
	assert.equal(sniffImageType(out), "webp")
})

test("bytes that aren't an image are refused by the encoder", async () => {
	const { encodeAvatar } = await import("./image-type.ts")
	await assert.rejects(
		encodeAvatar(Uint8Array.from([0xff, 0xd8, 0xff, 1, 2, 3])),
	)
})
