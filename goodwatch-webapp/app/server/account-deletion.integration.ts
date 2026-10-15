// Members delete their account (#553): Better Auth's deleteUser with the CrateDB member data, MCP grants and every
// session. Runs against the disposable three-node CrateDB, three-master Valkey and Mailpit of
// scripts/auth-deletion/run.sh, with the member tables created from the repository's own schemas.

// CommonJS packages load before the alias hook, which would otherwise resolve their own relative requires.
import "node-crate"
import "ioredis"
import "react"
import "react/jsx-runtime"
import "@remix-run/node"
import "zod"
import ts from "typescript"
import "./title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { after, before, test } from "node:test"
import {
	authTestCrateOrigins,
	authTestMailpitURL,
	authTestSmtpPort,
	authTestValkeyPort,
} from "./auth/store-fixtures.integration.ts"

// The member data deletion reaches share lists (JSX designs, a raw SVG import, TS parameter properties) and the
// taste store (the title snapshot's index needs a build). Node strips types only, so those are transpiled or
// replaced here, as in share-lists/view.test.ts and watch-state.test.ts.
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: unknown,
			next: (specifier: string, context: unknown) => unknown,
		): unknown
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
const transpile = (source: string, url: string) =>
	ts.transpileModule(source, {
		fileName: new URL(url).pathname,
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ESNext,
			jsx: ts.JsxEmit.ReactJSX,
		},
	}).outputText
registerHooks({
	resolve(specifier, context, next) {
		if (specifier.endsWith(".svg?raw"))
			return {
				url: new URL(`../${specifier.slice(2)}`, import.meta.url).href,
				shortCircuit: true,
			}
		return next(specifier, context)
	},
	load(url, context, next) {
		if (url.endsWith(".svg?raw"))
			return {
				format: "module",
				source: `export default ${JSON.stringify(readFileSync(new URL(url), "utf8"))}`,
				shortCircuit: true,
			}
		if (url.endsWith("/title-snapshot/format.server.ts"))
			return {
				format: "module",
				source: transpile(
					`${readFileSync(new URL(url), "utf8")}\nexport const getTitleSnapshot = () => null`,
					url,
				),
				shortCircuit: true,
			}
		if (url.endsWith(".tsx") || url.endsWith("/share-lists/store.server.ts"))
			return {
				format: "module",
				source: transpile(readFileSync(new URL(url), "utf8"), url),
				shortCircuit: true,
			}
		return next(url, context)
	},
})

// The webapp's own Crate client reads and deletes the member tables on the same disposable cluster.
process.env.CRATE_HOSTS = "127.0.0.1"
process.env.CRATE_PORT = new URL(authTestCrateOrigins[0]).port
process.env.CRATE_USER = "crate"
process.env.CRATE_PASS = ""
process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
process.env.TITLE_SNAPSHOT_REDIS_URL = ""
process.env.TITLE_CARDS_REDIS_URL = ""

const Redis = (await import("ioredis")).default
const { createGoodwatchAuth } = await import("./auth/auth.server.ts")
const {
	authModelTable,
	authModels,
	localAuthEncryptionSecret,
	localCrateTransport,
	migrateAuthTables,
} = await import("./auth/crate-adapter.server.ts")
const { AuthMailQueue, smtpTransport } = await import("./auth/mail.server.ts")
const { authPayloadCodec } = await import("./auth/payload-codec.server.ts")
const { ValkeyAuthStorage } = await import("./auth/secondary-storage.server.ts")
const { deleteMemberData, memberRowCounts } = await import(
	"./account-deletion.server.ts"
)
const { MEMBER_TABLES } = await import("./account-deletion-tables.ts")
const { holdTasteRebuildsForTest } = await import("./taste/member.server.ts")
holdTasteRebuildsForTest()

const origin = "http://localhost:3000"
const resource = `${origin}/mcp`
const secret = "disposable-local-deletion-secret-at-least-32"
const sql = localCrateTransport(authTestCrateOrigins)
const redis = new Redis.Cluster(
	[{ host: "127.0.0.1", port: authTestValkeyPort }],
	{
		natMap: JSON.parse(process.env.AUTH_TEST_VALKEY_NAT ?? "{}"),
		redisOptions: { maxRetriesPerRequest: 0, commandTimeout: 3000 },
	},
)
const storage = new ValkeyAuthStorage(() => redis)
const mail = new AuthMailQueue(
	smtpTransport({
		host: "127.0.0.1",
		port: authTestSmtpPort,
		localCatcher: true,
	}),
	{
		retryDelayMs: 10,
	},
)
const options = {
	sql,
	storage,
	mail,
	baseURL: origin,
	secret,
	google: {
		clientId: "local-google-client",
		clientSecret: "local-google-secret",
	},
	mcp: { resource, accessTokenExpiresIn: 60 },
}
const auth = createGoodwatchAuth({
	...options,
	accountDeletion: { deleteMemberData },
})
// Links that expire after a second, for the expired-link case.
const shortLived = createGoodwatchAuth({
	...options,
	accountDeletion: { deleteMemberData, linkSeconds: 1 },
})

const password = "a secure password for tests"
const email = () => `delete-${randomUUID()}@example.test`
const cookiesOf = (response: Response) =>
	response.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ")
async function call(
	path: string,
	body?: unknown,
	cookie = "",
	service = auth,
	ip = "127.0.0.1",
) {
	return service.handler(
		new Request(`${origin}/api/auth${path}`, {
			method: body === undefined ? "GET" : "POST",
			headers: {
				"content-type": "application/json",
				origin,
				cookie,
				"x-forwarded-for": ip,
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		}),
	)
}
async function messages(address: string) {
	await mail.drain()
	const data = await (
		await fetch(
			`${authTestMailpitURL}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`,
		)
	).json()
	return Promise.all(
		data.messages
			.reverse()
			.map(async (m: { ID: string }) =>
				(await fetch(`${authTestMailpitURL}/api/v1/message/${m.ID}`)).json(),
			),
	)
}
const linkIn = (message: { Text: string }, path = "/api/auth/") =>
	message.Text.match(new RegExp(`http://localhost:3000${path}\\S+`))?.[0]
async function session(cookie: string, service = auth) {
	const response = await call("/get-session", undefined, cookie, service)
	assert.equal(response.status, 200)
	return (await response.json()) as {
		user: { id: string; email: string }
	} | null
}

/** Signs up, confirms by email and signs in: the confirmed member and the cookie of that first device. */
async function member(address = email()) {
	assert.equal(
		(await call("/sign-up/email", { email: address, name: "", password }))
			.status,
		200,
	)
	const confirmation = linkIn((await messages(address)).at(-1))
	assert.ok(confirmation, "confirmation link")
	const confirmed = await auth.handler(new Request(confirmation))
	assert.ok([200, 302].includes(confirmed.status))
	const cookie = cookiesOf(confirmed)
	const current = await session(cookie)
	assert.ok(current)
	return { address, cookie, id: current.user.id }
}
async function signIn(address: string) {
	const response = await call("/sign-in/email", { email: address, password })
	assert.equal(response.status, 200, await response.clone().text())
	return cookiesOf(response)
}

/** Registers an MCP client, consents for the member and returns its access and refresh tokens. */
async function mcpGrant(cookie: string) {
	const registration = await call("/oauth2/register", {
		client_name: "Local MCP client",
		application_type: "native",
		redirect_uris: ["http://127.0.0.1:6280/callback"],
		token_endpoint_auth_method: "none",
		grant_types: ["authorization_code", "refresh_token"],
		response_types: ["code"],
		scope: "mcp:read mcp:write offline_access",
	})
	assert.equal(registration.status, 201)
	const client = await registration.json()
	const verifier = "v".repeat(64)
	const query = new URLSearchParams({
		client_id: client.client_id,
		redirect_uri: client.redirect_uris[0],
		response_type: "code",
		scope: "mcp:read mcp:write offline_access",
		resource,
		state: "local-state",
		code_challenge_method: "S256",
		code_challenge: createHash("sha256").update(verifier).digest("base64url"),
	})
	const authorization = await auth.handler(
		new Request(`${origin}/api/auth/oauth2/authorize?${query}`, {
			headers: { cookie, accept: "application/json" },
		}),
	)
	assert.equal(authorization.status, 200)
	const consentUrl = new URL((await authorization.json()).url, origin)
	const allowed = await call(
		"/oauth2/consent",
		{ accept: true, oauth_query: consentUrl.search.slice(1) },
		cookie,
	)
	assert.equal(allowed.status, 200)
	const code = new URL((await allowed.json()).url).searchParams.get("code")
	assert.ok(code)
	const token = await auth.handler(
		new Request(`${origin}/api/auth/oauth2/token`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				client_id: client.client_id,
				redirect_uri: client.redirect_uris[0],
				code,
				code_verifier: verifier,
				resource,
			}),
		}),
	)
	assert.equal(token.status, 200)
	const tokens = await token.json()
	assert.ok(tokens.refresh_token)
	return { client, tokens }
}
async function refresh(grant: Awaited<ReturnType<typeof mcpGrant>>) {
	return auth.handler(
		new Request(`${origin}/api/auth/oauth2/token`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "refresh_token",
				client_id: grant.client.client_id,
				refresh_token: grant.tokens.refresh_token,
				resource,
			}),
		}),
	)
}
/** Whether the MCP endpoint's verifier accepts the access token. */
async function mcpAccepts(accessToken: string) {
	const { setAuthForTest } = await import("./auth/runtime.server.ts")
	const { mcpAuthorization } = await import("./mcp/authorization.server.ts")
	process.env.BETTER_AUTH_ENABLED = "true"
	process.env.MCP_RESOURCE_URL = resource
	setAuthForTest(auth)
	try {
		await mcpAuthorization.verifyAccessToken(accessToken)
		return true
	} catch {
		return false
	} finally {
		setAuthForTest(null)
		Reflect.deleteProperty(process.env, "BETTER_AUTH_ENABLED")
		Reflect.deleteProperty(process.env, "MCP_RESOURCE_URL")
	}
}

/** One row in every member table, as the webapp writes them. */
async function seedMemberRows(userId: string, handle: string) {
	const now = Date.now()
	const stamps = { created_at: now, updated_at: now }
	const title = { tmdb_id: 603, media_type: "movie" }
	const importId = `import-${userId}`
	const rows: Record<
		(typeof MEMBER_TABLES)[number],
		Record<string, unknown>
	> = {
		user_setting: {
			user_id: userId,
			key: "country_default",
			value: "DE",
			...stamps,
		},
		user_skipped: { user_id: userId, ...title, ...stamps },
		user_not_interested: { user_id: userId, ...title, ...stamps },
		user_wishlist: { user_id: userId, ...title, ...stamps },
		user_favorite: { user_id: userId, ...title, ...stamps },
		user_score: {
			user_id: userId,
			...title,
			score: 9,
			review: "Still holds up",
			...stamps,
		},
		user_watch_log: {
			user_id: userId,
			watch_id: "score-movie-603",
			...title,
			watched_at_precision: "unknown",
			origin: "score",
			pass: 1,
			...stamps,
		},
		user_watch_state: {
			user_id: userId,
			...title,
			state: "seen",
			state_changed_at: now,
			pass: 1,
			...stamps,
		},
		user_import: {
			id: importId,
			user_id: userId,
			source: "imdb",
			status: "done",
			counts: "{}",
			processed: 1,
			total: 1,
			added: 1,
			updated: 0,
			kept: 0,
			failed: 0,
			...stamps,
		},
		user_import_item: {
			import_id: importId,
			row_index: 0,
			user_id: userId,
			imdb_id: "tt0133093",
			outcome: "new",
		},
		user_mcp_action: {
			user_id: userId,
			action_id: randomUUID(),
			request_hash: "hash",
			owner_id: "owner",
			...stamps,
		},
		user_list_exposure: {
			user_id: userId,
			list_id: "discover",
			surface: "discover",
			ordering: "popular",
			sort: "popular",
			for_you: false,
			for_you_applied: false,
			country: "DE",
			taste_key_version: "v2",
			batch: "page",
			title_keys: [603],
			...stamps,
		},
		user_list: {
			id: `L${userId.replaceAll("-", "").slice(0, 9)}`,
			user_id: userId,
			title: "My top 5",
			design: "manifesto",
			theme: "midnight",
			items: [{ media_type: "movie", tmdb_id: 603 }],
			visibility: "public",
			content_hash: "hash",
			...stamps,
		},
		user_profile: { user_id: userId, handle, ...stamps },
		user_handle: { handle, user_id: userId, claimed_at: now },
	}
	for (const [table, row] of Object.entries(rows)) {
		const columns = Object.keys(row)
		await sql(
			`INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
			Object.values(row),
		)
	}
	await sql(`REFRESH TABLE ${MEMBER_TABLES.join(", ")}`)
}
const everyTableHasOne = Object.fromEntries(MEMBER_TABLES.map((t) => [t, 1]))
const everyTableEmpty = Object.fromEntries(MEMBER_TABLES.map((t) => [t, 0]))

/**
 * Every live auth row that names the member or their address, after decrypting it. A deleted row keeps only its id
 * as a tombstone (#548); it must hold nothing else.
 */
async function authRowsOf(userId: string, address: string) {
	const codec = authPayloadCodec(localAuthEncryptionSecret)
	const found: string[] = []
	for (const model of authModels) {
		const table = authModelTable(model)
		await sql(`REFRESH TABLE ${table}`)
		const { rows } = await sql(`SELECT id, payload FROM ${table}`)
		for (const [id, payload] of rows) {
			const envelope = codec.decode(payload, `${table}:${id}:payload`)
			const text = JSON.stringify(envelope.row)
			if (envelope.deleted) {
				assert.deepEqual(
					Object.keys(envelope.row),
					["id"],
					`${model} tombstone keeps only its id`,
				)
				assert.equal(envelope.emailClaim, undefined)
				continue
			}
			if (
				text.includes(userId) ||
				text.toLowerCase().includes(address.toLowerCase())
			)
				found.push(`${model}:${id}`)
		}
	}
	await sql("REFRESH TABLE doc.auth_user_email")
	const claims = await sql(
		"SELECT count(*) FROM doc.auth_user_email WHERE user_id = ?",
		[userId],
	)
	if (Number(claims.rows[0][0]) > 0) found.push("auth_user_email")
	return found
}

before(async () => {
	await migrateAuthTables(sql)
	await redis.ping()
	for (const table of MEMBER_TABLES) await sql(`SELECT count(*) FROM ${table}`)
})
after(async () => {
	await mail.drain()
	redis.disconnect()
})

test("a member deletes their account with their password: sessions, MCP grants and every row of theirs are gone, and the address can sign up again", async () => {
	const deleting = await member()
	const otherDevice = await signIn(deleting.address)
	const grant = await mcpGrant(deleting.cookie)
	await seedMemberRows(deleting.id, `del${deleting.id.slice(0, 8)}`)
	const bystander = await member()
	await seedMemberRows(bystander.id, `by${bystander.id.slice(0, 8)}`)
	assert.deepEqual(await memberRowCounts(deleting.id), everyTableHasOne)
	assert.ok(
		await mcpAccepts(grant.tokens.access_token),
		"the MCP token works before deletion",
	)
	assert.ok(await session(otherDevice))

	const response = await call("/delete-user", { password }, deleting.cookie)
	assert.equal(response.status, 200, await response.clone().text())
	assert.deepEqual(await response.json(), {
		success: true,
		message: "User deleted",
	})
	assert.match(
		response.headers.get("set-cookie") ?? "",
		/gw\.session_token=;/,
		"the browser's cookie is cleared",
	)

	assert.equal(
		await session(deleting.cookie),
		null,
		"this device is signed out",
	)
	assert.equal(
		await session(otherDevice),
		null,
		"the other device is signed out",
	)
	assert.equal(
		await mcpAccepts(grant.tokens.access_token),
		false,
		"the MCP access token stops working",
	)
	const renewed = await refresh(grant)
	assert.equal(renewed.status, 400)
	assert.equal((await renewed.json()).error, "invalid_grant")
	assert.deepEqual(await memberRowCounts(deleting.id), everyTableEmpty)
	assert.deepEqual(await authRowsOf(deleting.id, deleting.address), [])
	assert.equal(await redis.get(`gw:auth:active-sessions-${deleting.id}`), null)

	// Nobody else's data moved, and the handle stays reserved without pointing at the deleted member.
	assert.deepEqual(await memberRowCounts(bystander.id), everyTableHasOne)
	assert.ok(await session(bystander.cookie))
	const handle = await sql(
		"SELECT user_id, deleted_at FROM doc.user_handle WHERE handle = ?",
		[`del${deleting.id.slice(0, 8)}`],
	)
	assert.equal(handle.rows.length, 1)
	assert.notEqual(handle.rows[0][0], deleting.id)
	assert.ok(handle.rows[0][1])

	assert.match(
		(await messages(deleting.address)).at(-1).Subject,
		/account is deleted/i,
	)
	const again = await member(deleting.address)
	assert.notEqual(
		again.id,
		deleting.id,
		"the address signs up again as a new member",
	)
	assert.deepEqual(await memberRowCounts(again.id), everyTableEmpty)
})

test("a wrong password deletes nothing and keeps every session; repeated tries are throttled", async () => {
	const kept = await member()
	const otherDevice = await signIn(kept.address)
	await seedMemberRows(kept.id, `kp${kept.id.slice(0, 8)}`)
	const response = await call(
		"/delete-user",
		{ password: "not the password at all" },
		kept.cookie,
	)
	assert.equal(response.status, 400)
	assert.equal((await response.json()).code, "INVALID_PASSWORD")
	assert.ok(await session(kept.cookie))
	assert.ok(await session(otherDevice))
	assert.deepEqual(await memberRowCounts(kept.id), everyTableHasOne)
	for (let attempt = 2; attempt <= 10; attempt++)
		assert.equal(
			(
				await call(
					"/delete-user",
					{ password: `wrong ${attempt} password` },
					kept.cookie,
				)
			).status,
			400,
		)
	const throttled = await call("/delete-user", { password }, kept.cookie)
	assert.equal(
		throttled.status,
		429,
		"the right password is refused too once the tries are used up",
	)
	assert.ok(await session(kept.cookie))
	assert.deepEqual(await memberRowCounts(kept.id), everyTableHasOne)
})

test("deleting from one device while another is in use signs both out and stops the other device's writes", async () => {
	const deleting = await member()
	const phone = await signIn(deleting.address)
	await seedMemberRows(deleting.id, `ph${deleting.id.slice(0, 8)}`)
	assert.ok(await session(deleting.cookie))
	const response = await call("/delete-user", { password }, phone)
	assert.equal(response.status, 200)
	assert.equal(await session(deleting.cookie), null)
	assert.equal(await session(phone), null)
	assert.equal(
		(
			await call(
				"/change-password",
				{ currentPassword: password, newPassword: `${password}!` },
				deleting.cookie,
			)
		).status,
		401,
	)
	assert.deepEqual(await memberRowCounts(deleting.id), everyTableEmpty)
	assert.deepEqual(await authRowsOf(deleting.id, deleting.address), [])
})

test("the email link deletes once: a replayed link and an expired link delete nothing", async () => {
	const deleting = await member()
	await seedMemberRows(deleting.id, `em${deleting.id.slice(0, 8)}`)
	const requested = await call("/delete-user", {}, deleting.cookie)
	assert.equal(requested.status, 200)
	assert.deepEqual(await requested.json(), {
		success: true,
		message: "Verification email sent",
	})
	assert.ok(
		await session(deleting.cookie),
		"asking for the link deletes nothing yet",
	)
	assert.deepEqual(await memberRowCounts(deleting.id), everyTableHasOne)
	const message = (await messages(deleting.address)).at(-1)
	assert.match(message.Subject, /deleting your GoodWatch account/i)
	const link = linkIn(message, "/delete-account")
	assert.ok(
		link,
		"the email links to the site's confirmation page, not to an API that deletes on open",
	)
	const token = new URL(link).searchParams.get("token")
	assert.ok(token)
	// The old one-click callback is closed: opening a link never deletes anything.
	assert.equal(
		(
			await call(
				`/delete-user/callback?token=${token}`,
				undefined,
				deleting.cookie,
			)
		).status,
		404,
	)
	assert.ok(await session(deleting.cookie))

	const confirmed = await call("/delete-user", { token }, deleting.cookie)
	assert.equal(confirmed.status, 200, await confirmed.clone().text())
	assert.equal(await session(deleting.cookie), null)
	assert.deepEqual(await memberRowCounts(deleting.id), everyTableEmpty)
	assert.deepEqual(await authRowsOf(deleting.id, deleting.address), [])

	// Replayed by the same address's new account: the token is spent.
	const again = await member(deleting.address)
	await seedMemberRows(again.id, `ag${again.id.slice(0, 8)}`)
	assert.equal(
		(await call("/delete-user", { token }, again.cookie)).status,
		404,
	)
	assert.ok(await session(again.cookie))
	assert.deepEqual(await memberRowCounts(again.id), everyTableHasOne)

	// A link past its hour.
	assert.equal(
		(await call("/delete-user", {}, again.cookie, shortLived)).status,
		200,
	)
	const late = new URL(
		linkIn((await messages(again.address)).at(-1), "/delete-account") ?? "",
	).searchParams.get("token")
	assert.ok(late)
	await new Promise((resolve) => setTimeout(resolve, 1500))
	assert.equal(
		(await call("/delete-user", { token: late }, again.cookie, shortLived))
			.status,
		404,
	)
	assert.ok(await session(again.cookie))
	assert.deepEqual(await memberRowCounts(again.id), everyTableHasOne)
})

test("a link opened by another signed-in member deletes nobody", async () => {
	const owner = await member()
	const stranger = await member()
	assert.equal((await call("/delete-user", {}, owner.cookie)).status, 200)
	const token = new URL(
		linkIn((await messages(owner.address)).at(-1), "/delete-account") ?? "",
	).searchParams.get("token")
	assert.ok(token)
	assert.equal(
		(await call("/delete-user", { token }, stranger.cookie)).status,
		404,
	)
	assert.ok(await session(owner.cookie))
	assert.ok(await session(stranger.cookie))
})

test("a signed-out request deletes nothing, and email links are limited per member", async () => {
	assert.equal((await call("/delete-user", { password })).status, 401)
	assert.equal((await call("/delete-user", { token: "made-up" })).status, 401)
	const asking = await member()
	for (let i = 0; i < 5; i++)
		assert.equal((await call("/delete-user", {}, asking.cookie)).status, 200)
	assert.equal((await call("/delete-user", {}, asking.cookie)).status, 429)
	assert.ok(await session(asking.cookie))
})

/** A Google sign-in through Better Auth's real OAuth callback, against a local token and key fixture. */
async function googleMember(address = email()) {
	const { createServer } = await import("node:http")
	const { generateKeyPair, exportJWK, SignJWT } = await import("jose")
	const { privateKey, publicKey } = await generateKeyPair("RS256")
	const jwk = {
		...(await exportJWK(publicKey)),
		kid: `local-${randomUUID()}`,
		alg: "RS256",
		use: "sig",
	}
	let challenge = ""
	const idToken = await new SignJWT({
		sub: `google-${address}`,
		email: address,
		email_verified: true,
		name: "Google member",
	})
		.setProtectedHeader({ alg: "RS256", kid: jwk.kid })
		.setIssuedAt()
		.setExpirationTime("1h")
		.setIssuer("https://accounts.google.com")
		.setAudience("local-google-client")
		.sign(privateKey)
	const fixture = createServer(async (req, res) => {
		res.setHeader("content-type", "application/json")
		if (req.url === "/certs") return res.end(JSON.stringify({ keys: [jwk] }))
		let body = ""
		for await (const chunk of req) body += chunk
		const params = new URLSearchParams(body)
		if (
			createHash("sha256")
				.update(params.get("code_verifier") ?? "")
				.digest("base64url") !== challenge
		) {
			res.statusCode = 400
			return res.end(JSON.stringify({ error: "invalid_grant" }))
		}
		res.end(
			JSON.stringify({
				access_token: "local-access",
				id_token: idToken,
				token_type: "Bearer",
				expires_in: 3600,
			}),
		)
	})
	await new Promise<void>((resolve) => fixture.listen(0, "127.0.0.1", resolve))
	const port = (fixture.address() as import("node:net").AddressInfo).port
	const originalFetch = globalThis.fetch
	globalThis.fetch = async (input, init) => {
		const url = new URL(input instanceof Request ? input.url : String(input))
		if (url.href === "https://oauth2.googleapis.com/token")
			return originalFetch(`http://127.0.0.1:${port}/token`, init)
		if (url.href === "https://www.googleapis.com/oauth2/v3/certs")
			return originalFetch(`http://127.0.0.1:${port}/certs`, init)
		if (!["127.0.0.1", "localhost"].includes(url.hostname))
			throw new Error("External auth network blocked in test")
		return originalFetch(input, init)
	}
	try {
		const start = await call("/sign-in/social", {
			provider: "google",
			callbackURL: `${origin}/`,
		})
		assert.equal(start.status, 200)
		const authorization = new URL((await start.json()).url)
		challenge = authorization.searchParams.get("code_challenge") ?? ""
		const callback = await call(
			`/callback/google?code=local-code&state=${authorization.searchParams.get("state")}`,
			undefined,
			cookiesOf(start),
		)
		const cookie = cookiesOf(callback)
		const current = await session(cookie)
		assert.ok(current, "signed in with Google")
		return { address, cookie, id: current.user.id }
	} finally {
		globalThis.fetch = originalFetch
		await new Promise<void>((resolve) => fixture.close(() => resolve()))
	}
}

test("a Google-only member confirms by email link, cannot confirm with a password, and can sign in with Google again", async () => {
	const google = await googleMember()
	await seedMemberRows(google.id, `go${google.id.slice(0, 8)}`)
	const methods = await (
		await call("/list-accounts", undefined, google.cookie)
	).json()
	assert.deepEqual(
		methods.map((account: { providerId: string }) => account.providerId),
		["google"],
	)
	const withPassword = await call("/delete-user", { password }, google.cookie)
	assert.equal(withPassword.status, 400)
	assert.equal(
		(await withPassword.json()).code,
		"INVALID_PASSWORD",
		"the same answer as a wrong password",
	)
	assert.ok(await session(google.cookie))

	assert.equal((await call("/delete-user", {}, google.cookie)).status, 200)
	const token = new URL(
		linkIn((await messages(google.address)).at(-1), "/delete-account") ?? "",
	).searchParams.get("token")
	assert.ok(token)
	assert.equal(
		(await call("/delete-user", { token }, google.cookie)).status,
		200,
	)
	assert.equal(await session(google.cookie), null)
	assert.deepEqual(await memberRowCounts(google.id), everyTableEmpty)
	assert.deepEqual(await authRowsOf(google.id, google.address), [])

	const back = await googleMember(google.address)
	assert.notEqual(
		back.id,
		google.id,
		"Google sign-in creates a new member for the released address",
	)
})

test("member data deletion can run again after a partial failure", async () => {
	const userId = randomUUID()
	await seedMemberRows(userId, `pa${userId.slice(0, 8)}`)
	await deleteMemberData(userId)
	await deleteMemberData(userId)
	assert.deepEqual(await memberRowCounts(userId), everyTableEmpty)
})

test("without the webapp's member data deletion, deleting an account is switched off", async () => {
	const withoutData = createGoodwatchAuth(options)
	const kept = await member()
	assert.equal(
		(await call("/delete-user", { password }, kept.cookie, withoutData)).status,
		404,
	)
	assert.equal(
		(await call("/delete-user", {}, kept.cookie, withoutData)).status,
		404,
	)
	assert.ok(await session(kept.cookie))
})
