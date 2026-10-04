import assert from "node:assert/strict"
import { createServer } from "node:http"
import { after, beforeEach, test } from "node:test"
import { SignJWT, exportJWK, generateKeyPair } from "jose"

const pair = await generateKeyPair("ES256")
const jwk = { ...(await exportJWK(pair.publicKey)), kid: "test-key" }
const requests = new Map<string, number>()
const accepted = new Map<string, string>()
let userStatus = 200
let refresh: ReturnType<typeof session> | undefined
const server = createServer((req, res) => {
	const path = new URL(req.url ?? "/", "http://localhost").pathname
	requests.set(path, (requests.get(path) ?? 0) + 1)
	res.setHeader("Content-Type", "application/json")
	if (path.endsWith("jwks.json"))
		return res.end(JSON.stringify({ keys: [jwk] }))
	if (path.endsWith("/token") && refresh)
		return res.end(JSON.stringify(refresh))
	const id = accepted.get(
		req.headers.authorization?.replace("Bearer ", "") ?? "",
	)
	res.statusCode = userStatus === 500 ? 500 : id ? 200 : 401
	res.end(
		JSON.stringify(
			res.statusCode === 200
				? user(id ?? "")
				: { code: res.statusCode, msg: "invalid" },
		),
	)
})
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
const address = server.address()
assert.ok(address && typeof address !== "string")
const url = `http://127.0.0.1:${address.port}`
const previousUrl = process.env.SUPABASE_URL
const previousKey = process.env.SUPABASE_ANON_KEY
process.env.SUPABASE_URL = url
process.env.SUPABASE_ANON_KEY = "test-anon-key"
const {
	resolveSession,
	resetAuthSessionForTest,
	authCheckCounts,
	AUTH_MEMO_MS,
} = await import("./auth-session.ts")
const { getAuthFromRequest } = await import("./auth.ts")
after(async () => {
	if (previousUrl === undefined)
		Reflect.deleteProperty(process.env, "SUPABASE_URL")
	else process.env.SUPABASE_URL = previousUrl
	if (previousKey === undefined)
		Reflect.deleteProperty(process.env, "SUPABASE_ANON_KEY")
	else process.env.SUPABASE_ANON_KEY = previousKey
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve())),
	)
})
beforeEach(() => {
	resetAuthSessionForTest()
	requests.clear()
	accepted.clear()
	userStatus = 200
	refresh = undefined
})
function user(id: string) {
	return {
		id,
		aud: "authenticated",
		role: "authenticated",
		email: `${id}@example.test`,
		app_metadata: {},
		user_metadata: {},
		created_at: "",
	}
}
function session(
	token: string,
	id = "cookie-user",
	expiresAt = Math.floor(Date.now() / 1000) + 3600,
) {
	return {
		access_token: token,
		refresh_token: "refresh",
		token_type: "bearer",
		expires_in: 3600,
		expires_at: expiresAt,
		user: user(id),
	}
}
function cookie(token: string, expiresAt?: number, chunked = false) {
	// SSR 0.5 uses base64url JSON, with numeric chunks (normally 3180 bytes).
	const value = `base64-${Buffer.from(JSON.stringify(session(token, "untrusted-cookie-user", expiresAt))).toString("base64url")}`
	if (chunked)
		return `sb-127-auth-token.1=${value.slice(100)}; sb-127-auth-token.0=${value.slice(0, 100)}`
	return `sb-127-auth-token=${value}`
}
async function token(
	id: string,
	options: {
		hs?: boolean
		key?: CryptoKey
		issuer?: string
		exp?: number
	} = {},
) {
	return new SignJWT({
		role: "authenticated",
		email: `${id}@signed.test`,
		user_metadata: { name: id },
	})
		.setProtectedHeader(
			options.hs ? { alg: "HS256" } : { alg: "ES256", kid: "test-key" },
		)
		.setSubject(id)
		.setAudience("authenticated")
		.setIssuer(options.issuer ?? `${url}/auth/v1`)
		.setExpirationTime(options.exp ?? Math.floor(Date.now() / 1000) + 3600)
		.sign(
			options.hs
				? crypto.getRandomValues(new Uint8Array(32))
				: (options.key ?? pair.privateKey),
		)
}
const count = (path: string) => requests.get(`/auth/v1/${path}`) ?? 0

test("no auth cookie creates no client or requests", async () => {
	assert.deepEqual(await resolveSession("_ga=123"), {
		user: null,
		source: "none",
		setCookies: [],
	})
	assert.equal(requests.size, 0)
	assert.equal(authCheckCounts.none, 1)
})
test("HS256 concurrent and subsequent callers share the server result", async () => {
	const jwt = await token("one", { hs: true })
	accepted.set(jwt, "one")
	const first = resolveSession(cookie(jwt))
	const second = resolveSession(cookie(jwt))
	assert.equal(first, second)
	const results = [
		...(await Promise.all([first, second])),
		await resolveSession(cookie(jwt)),
	]
	for (const result of results) assert.equal(result.user?.id, "one")
	assert.equal(count("user"), 1)
	assert.equal(count(".well-known/jwks.json"), 0)
	assert.equal(authCheckCounts.memo, 2)
})
test("members are isolated and analytics cookies do not affect chunked memo keys", async () => {
	const a = await token("a", { hs: true })
	const b = await token("b", { hs: true })
	accepted.set(a, "a")
	accepted.set(b, "b")
	const results = await Promise.all([
		resolveSession(cookie(a, undefined, true)),
		resolveSession(cookie(b)),
		resolveSession(`_ga=123; ${cookie(a, undefined, true)}`),
		resolveSession(cookie(b)),
	])
	assert.deepEqual(
		results.map((result) => result.user?.id),
		["a", "b", "a", "b"],
	)
	assert.equal(count("user"), 2)
})
test("ES256 uses signed claims and shares the JWKS across members", async () => {
	for (const id of ["a", "b", "c"]) {
		const result = await resolveSession(cookie(await token(id)))
		assert.equal(result.source, "local")
		assert.equal(result.user?.id, id)
		assert.equal(result.user?.email, `${id}@signed.test`)
		assert.deepEqual(result.user?.user_metadata, { name: id })
	}
	assert.equal(count("user"), 0)
	assert.equal(count(".well-known/jwks.json"), 1)
})
test("forged signatures fall back to the server", async () => {
	const forged = await generateKeyPair("ES256")
	assert.equal(
		(
			await resolveSession(
				cookie(await token("forged", { key: forged.privateKey })),
			)
		).user,
		null,
	)
	assert.equal(count("user"), 1)
})
test("wrong issuer falls back to the server", async () => {
	assert.equal(
		(
			await resolveSession(
				cookie(await token("wrong", { issuer: "https://wrong.test/auth/v1" })),
			)
		).user,
		null,
	)
	assert.equal(count("user"), 1)
})
test("expired sessions refresh and share cookies through independent response headers", async () => {
	const expired = await token("old", {
		exp: Math.floor(Date.now() / 1000) - 100,
	})
	refresh = session(await token("renewed"))
	const header = cookie(expired, Math.floor(Date.now() / 1000) - 100)
	const result = await resolveSession(header)
	assert.equal(result.source, "local")
	assert.equal(result.user?.id, "renewed")
	assert.ok(
		result.setCookies.some((value) => value.startsWith("sb-127-auth-token=")),
	)
	assert.equal(count("token"), 1)
	assert.equal(count("user"), 0)
	const request = new Request("http://localhost/", {
		headers: { Cookie: header },
	})
	const a = await getAuthFromRequest({ request })
	const b = await getAuthFromRequest({ request })
	assert.notEqual(a.headers, b.headers)
	assert.equal(a.headers.get("Cache-Control"), "private, no-store")
	assert.deepEqual(a.headers.getSetCookie(), result.setCookies)
	assert.deepEqual(b.headers.getSetCookie(), result.setCookies)
})
test("fresh bypasses local verification and replaces an existing memo", async () => {
	const jwt = await token("local")
	const header = cookie(jwt)
	assert.equal((await resolveSession(header)).source, "local")
	accepted.set(jwt, "server")
	assert.equal(
		(await resolveSession(header, { fresh: true })).user?.id,
		"server",
	)
	assert.equal((await resolveSession(header)).user?.id, "server")
	assert.equal(count("user"), 1)
})
test("server memo expires after AUTH_MEMO_MS", async (t) => {
	const jwt = await token("one", { hs: true })
	accepted.set(jwt, "one")
	t.mock.timers.enable({ apis: ["Date"], now: Date.now() })
	const header = cookie(jwt)
	await resolveSession(header)
	await resolveSession(header)
	assert.equal(count("user"), 1)
	t.mock.timers.tick(AUTH_MEMO_MS + 1)
	await resolveSession(header)
	assert.equal(count("user"), 2)
})
test("local memo ends at the signed expiry, even inside clock tolerance", async (t) => {
	const exp = Math.floor(Date.now() / 1000) + 10
	const header = cookie(await token("short", { exp }))
	t.mock.timers.enable({ apis: ["Date"], now: Date.now() })
	assert.equal((await resolveSession(header)).source, "local")
	t.mock.timers.setTime(exp * 1000 + 1)
	assert.equal((await resolveSession(header)).source, "server")
	assert.equal(count("user"), 1)
})
test("500 failures are retried and counted; 401 failures are memoized", async () => {
	const header = cookie(await token("invalid", { hs: true }))
	userStatus = 500
	assert.equal((await resolveSession(header)).user, null)
	assert.equal((await resolveSession(header)).user, null)
	assert.equal(count("user"), 2)
	assert.equal(authCheckCounts.error, 2)
	userStatus = 200
	await resolveSession(header)
	await resolveSession(header)
	assert.equal(count("user"), 3)
	assert.equal(authCheckCounts.error, 2)
})
test("garbage cookie resolves to null without throwing", async () => {
	assert.equal((await resolveSession("sb-127-auth-token=forged")).user, null)
})
