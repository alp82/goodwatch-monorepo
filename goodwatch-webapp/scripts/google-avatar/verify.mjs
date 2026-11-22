import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { resolve } from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import mdx from "@mdx-js/rollup"
import sharp from "sharp"
import { createServer } from "vite"

const origin = "http://127.0.0.1:" + process.env.CRATE_PORT
const transport = globalThis.fetch
assert.equal((await (await transport(origin)).json()).cluster_name, "avatar-regression-isolated")
const sql = async (stmt, args = []) => {
	const response = await transport(origin + "/_sql", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ stmt, args }),
	})
	const result = await response.json()
	assert(response.ok, JSON.stringify(result))
	return result.rows
}
const source = "https://lh3.googleusercontent.com/a/fixture=s96-c"
const other = "https://lh3.googleusercontent.com/a-/new-source"
const png = async (background) =>
	sharp({ create: { width: 96, height: 96, channels: 3, background } })
		.png()
		.toBuffer()
const first = await png("#895537")
const second = await png("#226699")
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")
let reply = async () => new Response(first, { headers: { "content-type": "image/png" } })
let requests = 0
globalThis.fetch = (url, init) => {
	if (String(url).startsWith(origin + "/")) return transport(url, init)
	assert([source, other].includes(String(url)), "Unexpected remote request")
	assert.equal(init.redirect, "error")
	assert.equal(init.credentials, "omit")
	requests++
	return reply()
}

// Transform the real server modules and route, with no app entry point, .env, Redis or auth provider.
const vite = await createServer({
	configFile: false,
	root: process.cwd(),
	envDir: false,
	plugins: [mdx()],
	appType: "custom",
	logLevel: "error",
	resolve: { alias: { "~": resolve("app") } },
	server: { middlewareMode: true, hmr: false },
	optimizeDeps: { noDiscovery: true },
})
try {
	const load = (path) => vite.ssrLoadModule("/app/" + path)
	const { resolveAvatar } = await load("server/profile/avatar-choice.server.ts")
	const { getProfileSettings, saveProfileSettings } = await load(
		"server/profile/settings.server.ts",
	)
	const { DEFAULT_PROFILE_SETTINGS } = await load("domain/profile.ts")
	const { readProviderAvatar } = await load("server/profile/provider-avatar.server.ts")
	const { saveAvatar } = await load("server/profile/avatar.server.ts")
	const { encodeAvatar } = await load("server/profile/image-type.ts")
	const { loader } = await load("routes/api.avatar.$handle.ts")
	const id = "avatar-regression",
		handle = "test_owner"
	await sql(
		"INSERT INTO doc.user_profile (user_id, handle, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
		[id, handle],
	)
	await sql("REFRESH TABLE doc.user_profile")
	const pick = async (avatar, photo) =>
		assert(await saveProfileSettings(id, { ...DEFAULT_PROFILE_SETTINGS, avatar }, photo))
	const selected = async () => {
		const settings = await getProfileSettings(id)
		return resolveAvatar(id, handle, settings.avatar, settings.providerPhoto)
	}
	const request = (path, headers) =>
		loader({ params: { handle }, request: new Request(new URL(path, origin), { headers }) })
	const providerPath = "/api/avatar/" + handle + "?source=google"
	assert.equal((await selected()).url, null)
	assert.equal((await request(providerPath)).status, 404)
	assert.equal(requests, 0)
	await pick({ kind: "provider" }, source)
	assert.equal((await selected()).url, providerPath)
	const answers = await Promise.all(Array.from({ length: 6 }, () => request(providerPath)))
	const expected = await encodeAvatar(first)
	const etag = '"' + sha256(expected) + '"'
	for (const answer of answers) {
		assert.equal(answer.status, 200)
		assert.equal(answer.headers.get("content-type"), "image/webp")
		assert.equal(answer.headers.get("etag"), etag)
		assert.deepEqual(Buffer.from(await answer.arrayBuffer()), expected)
	}
	assert.equal(requests, 1)
	const unchanged = await request(providerPath, { "If-None-Match": etag })
	assert.equal(unchanged.status, 304)
	assert.equal(requests, 1)

	// The same account, source and sign-in time reuse the first stored copy.
	reply = async () => new Response(second, { headers: { "content-type": "image/png" } })
	const refreshed = await readProviderAvatar(id, { at: 100, photo: source })
	assert.equal(refreshed.version, sha256(await encodeAvatar(second)))
	assert.equal(requests, 2)
	await readProviderAvatar(id, { at: 100, photo: source })
	await readProviderAvatar(id, { at: 90, photo: other })
	assert.equal(requests, 2)
	assert.equal((await request(providerPath, { "If-None-Match": etag })).status, 200)

	reply = async () => new Response(null, { status: 503 })
	assert.equal(
		(await readProviderAvatar(id, { at: 110, photo: source })).version,
		refreshed.version,
	)
	assert.equal(requests, 3)
	assert.equal((await request(providerPath)).status, 200)
	assert.equal(requests, 3)
	// After the stored retry deadline, the next viewer can recover even without another login.
	const realNow = Date.now
	try {
		Date.now = () => realNow() + 61_000
		reply = async () => new Response(first, { headers: { "content-type": "image/png" } })
		assert.equal((await readProviderAvatar(id)).version, sha256(expected))
		assert.equal(requests, 4)
	} finally {
		Date.now = realNow
	}
	reply = async () => new Response(null, { status: 503 })
	assert.equal(await readProviderAvatar(id, { at: 120, photo: other }), null)
	assert.equal((await request(providerPath)).status, 404)
	assert.equal(requests, 5)
	assert.equal(await readProviderAvatar(id, { at: 122, photo: null }), null)
	assert.equal((await request(providerPath)).status, 404)
	assert.equal(requests, 5)

	reply = async () => new Response(first, { headers: { "content-type": "image/png" } })
	assert((await readProviderAvatar(id, { at: 125, photo: source })).data)

	// Independent module instances have separate in-flight maps, as separate web workers do.
	const peer = await load("server/profile/provider-avatar.server.ts?secondWorker")
	assert.notEqual(peer.readProviderAvatar, readProviderAvatar)
	let beginOld, releaseOld
	const oldBegan = new Promise((resolve) => (beginOld = resolve))
	const holdOld = new Promise((resolve) => (releaseOld = resolve))
	reply = async () => {
		beginOld()
		await holdOld
		return new Response(first, { headers: { "content-type": "image/png" } })
	}
	const superseded = readProviderAvatar(id, { at: 126, photo: source })
	await Promise.race([
		oldBegan,
		delay(8000, undefined, { ref: false }).then(() => {
			throw Error("First worker did not start")
		}),
	])
	reply = async () => new Response(second, { headers: { "content-type": "image/png" } })
	const winner = await peer.readProviderAvatar(id, { at: 127, photo: source })
	releaseOld()
	assert.equal(winner.version, sha256(await encodeAvatar(second)))
	assert.equal((await superseded).version, winner.version)
	assert.equal((await readProviderAvatar(id)).version, winner.version)

	// A pending refresh of the same URL has a previous good image but must still lose to a new upload.
	let begun, resume
	const started = new Promise((resolve) => (begun = resolve))
	const blocked = new Promise((resolve) => (resume = resolve))
	reply = async () => {
		begun()
		await blocked
		return new Response(first, { headers: { "content-type": "image/png" } })
	}
	const stale = readProviderAvatar(id, { at: 130, photo: source })
	await Promise.race([
		started,
		delay(8000, undefined, { ref: false }).then(() => {
			throw Error("Refresh did not start")
		}),
	])
	const uploaded = await encodeAvatar(second)
	const version = await saveAvatar(id, uploaded)
	await pick({ kind: "photo" }, null)
	resume()
	assert.equal(await stale, null)
	assert.equal((await request(providerPath)).status, 404)
	const upload = await selected()
	assert.equal(upload.url, "/api/avatar/" + handle + "?v=" + version)
	assert.deepEqual(Buffer.from(await (await request(upload.url)).arrayBuffer()), uploaded)
	await sql("REFRESH TABLE doc.user_provider_avatar")
	assert.deepEqual(
		await sql("SELECT user_id FROM doc.user_provider_avatar WHERE user_id=?", [id]),
		[],
	)
	console.log(
		"Passed initial selection, concurrent first use, real WebP and ETag, sign-in refresh, provider failures and concurrent upload replacement.",
	)
} finally {
	await vite.close()
	globalThis.fetch = transport
}
