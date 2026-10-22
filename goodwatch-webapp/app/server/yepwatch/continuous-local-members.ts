/** Explicit disposable LOCAL auth/data fixture. Existing central issuer and tracking reads, not production provisioning. */
import { readFile, writeFile } from "node:fs/promises"
import { randomBytes } from "node:crypto"
import Redis from "ioredis"
import type { Cluster } from "ioredis"
import { createGoodwatchAuth } from "../auth/auth.server.ts"
import { AuthMailQueue } from "../auth/mail.server.ts"
import {
	localCrateTransport,
	migrateAuthTables,
} from "../auth/crate-adapter.server.ts"
import { ValkeyAuthStorage } from "../auth/secondary-storage.server.ts"
import {
	loadMcpConsent,
	decideMcpConsent,
	unsignedQuery,
	consentHeaders,
} from "../auth/mcp-flow.server.ts"
import { listenYepWatch } from "./node-http.server.ts"
import { ContinuousMembers } from "./continuous-members.server.ts"
import { centralMemberIssuer } from "./continuous-member-issuer.server.ts"
import {
	goodwatchMemberPrefill,
	goodwatchSavedProgress,
} from "./continuous-member-reads.server.ts"
import type { ContinuousRepository } from "./continuous-types.ts"
const escape = (s: unknown) =>
	String(s).replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			]!,
	)
export async function localMemberFixture(
	repository: ContinuousRepository,
	origins: string[],
) {
	if (
		process.env.YEPWATCH_LOCAL_MEMBER_FIXTURE !== "1" ||
		process.env.YEPWATCH_LOCAL_PORT !== "15993" ||
		process.env.YEPWATCH_CRATEDB_ORIGIN !== "http://127.0.0.1:15986"
	)
		throw new Error("Explicit isolated member fixture endpoints required")
	const fixturePath = process.env.YEPWATCH_LOCAL_MEMBER_FILE
	if (!fixturePath?.startsWith("/tmp/yepwatch-"))
		throw new Error("Private fixture file required")
	const sql = localCrateTransport(["http://127.0.0.1:15748"])
	await migrateAuthTables(sql)
	const redis = new Redis("redis://127.0.0.1:46398")
	const messages: { text?: unknown }[] = []
	const mail = new AuthMailQueue({
		async sendMail(m) {
			messages.push(m)
			return {}
		},
	})
	const origin = "http://127.0.0.1:15984",
		resource = "http://127.0.0.1:15993/api/yepwatch/v1/continuous",
		callbackUrl = `${resource}/member/callback`
	let fixture: {
		email: string
		password: string
		clientId: string
		userId: string
	}
	try {
		fixture = JSON.parse(await readFile(fixturePath, "utf8"))
	} catch {
		fixture = {
			email: `yepwatch-demo-${randomBytes(6).toString("hex")}@example.invalid`,
			password: randomBytes(24).toString("base64url"),
			clientId: "local-provision-pending",
			userId: "",
		}
	}
	const policy = {
		resource,
		clientId: fixture.clientId,
		redirectUris: [callbackUrl],
	}
	const auth = createGoodwatchAuth({
		sql,
		storage: new ValkeyAuthStorage(() => redis as unknown as Cluster),
		mail,
		baseURL: origin,
		secret: "disposable-yepwatch-central-issuer-secret-20261022",
		google: { clientId: "unused-local", clientSecret: "unused-local" },
		mcp: { resource: `${origin}/mcp` },
		yepwatch: policy,
		rateLimit: { enabled: false },
	})
	const post = (path: string, value: unknown) =>
		auth.handler(
			new Request(`${origin}/api/auth${path}`, {
				method: "POST",
				headers: { origin, "content-type": "application/json" },
				body: JSON.stringify(value),
			}),
		)
	const context = await auth.$context
	if (!fixture.userId) {
		const signed = await post("/sign-up/email", {
			email: fixture.email,
			password: fixture.password,
			name: "Local YepWatch member",
		})
		if (!signed.ok) throw new Error("Local fixture signup failed")
		await mail.drain()
		const link = messages
			.map((m) => String(m.text))
			.join("\n")
			.match(/http:\/\/127\.0\.0\.1:15984\/api\/auth\/\S+/)?.[0]
		if (!link) throw new Error("Local verification mail absent")
		const verified = await auth.handler(new Request(link))
		if (![200, 302].includes(verified.status))
			throw new Error("Local verification failed")
		const user = await context.adapter.findOne<{ id: string }>({
			model: "user",
			where: [{ field: "email", value: fixture.email }],
		})
		if (!user) throw new Error("Local fixture identity unavailable")
		fixture.userId = user.id
	}
	if (fixture.clientId === "local-provision-pending") {
		const registered = await post("/oauth2/register", {
			client_name: "YepWatch local fixture",
			redirect_uris: [callbackUrl],
			application_type: "native",
			token_endpoint_auth_method: "none",
			scope: "yepwatch:read",
		})
		if (registered.status !== 201)
			throw new Error("Local public-client registration failed")
		fixture.clientId = (await registered.json()).client_id
		policy.clientId = fixture.clientId
		const target = await context.adapter.findOne<{ id: string }>({
			model: "oauthResource",
			where: [{ field: "identifier", value: resource }],
		})
		if (!target) throw new Error("Local resource missing")
		await context.adapter.create({
			model: "oauthClientResource",
			data: {
				clientId: fixture.clientId,
				resourceId: target.id,
				createdAt: new Date(),
			},
		})
	}
	await writeFile(fixturePath, JSON.stringify(fixture), { mode: 0o600 })
	await installLocalMemberData(fixture.userId)
	const members = new ContinuousMembers(
		repository,
		centralMemberIssuer({ ...policy, issuerOrigin: origin }, auth),
		{ prefill: goodwatchMemberPrefill, progress: goodwatchSavedProgress },
		{
			callbackUrl,
			browserOrigins: origins,
			nativeReturnUri: "yepwatch://auth/callback",
		},
	)
	const html = (body: string) =>
		new Response(
			`<!doctype html><meta name="viewport" content="width=device-width"><title>Local GoodWatch fixture</title><main style="font:18px system-ui;max-width:36rem;margin:3rem auto;padding:1rem">${body}</main>`,
			{
				headers: {
					"content-type": "text/html; charset=utf-8",
					"cache-control": "private, no-store",
					"referrer-policy": "no-referrer",
				},
			},
		)
	const server = await listenYepWatch(async (request) => {
		const u = new URL(request.url)
		if (u.pathname.startsWith("/api/auth/")) return auth.handler(request)
		if (u.pathname === "/auth/mcp/consent") {
			if (request.method === "POST") return decideMcpConsent(request, auth)
			const view = await loadMcpConsent(request, auth)
			if (view instanceof Response) return view
			const response = html(
				`<h1>Connect ${escape(view.app.name)}</h1><p>Local disposable GoodWatch fixture. Read private preferences and saved progress; no watch-history writes.</p><form method="post"><button name="decision" value="allow">Allow read access</button> <button name="decision" value="deny">Deny</button><input type="hidden" name="access" value="read"></form>`,
			)
			for (const [key, value] of consentHeaders(request))
				response.headers.set(key, value)
			return response
		}
		if (u.pathname === "/sign-in") {
			const { verifyOAuthQueryParams } = await import(
				"@goodwatch/auth-stack/oauth-provider"
			)
			const ctx = await auth.$context
			if (!(await verifyOAuthQueryParams(u.search.slice(1), ctx.secret)))
				return new Response("Invalid sign-in intent", { status: 400 })
			const onward = `/api/auth/oauth2/authorize?${unsignedQuery(u.searchParams)}`
			// Local test helper only. Explicit click signs in the generated disposable fixture through the REAL issuer.
			return html(
				`<h1>Local GoodWatch member</h1><p>This connects a disposable account with saved DE/Netflix preferences and one watched Breaking Bad episode. It does not use a production account.</p><button id="local-sign-in">Sign in to local GoodWatch</button><p id="error"></p><script>document.getElementById('local-sign-in').onclick=async()=>{const r=await fetch('/fixture/sign-in',{method:'POST',headers:{'content-type':'application/json'}});if(r.ok)location.href=${JSON.stringify(onward).replace(/</g, "\\u003c")};else document.getElementById('error').textContent='Local sign-in failed';}</script>`,
			)
		}
		if (u.pathname === "/fixture/sign-in" && request.method === "POST") {
			if (request.headers.get("origin") !== origin)
				return new Response("Origin required", { status: 403 })
			return post("/sign-in/email", {
				email: fixture.email,
				password: fixture.password,
			})
		}
		return new Response("Local fixture only", { status: 404 })
	}, 15984)
	return {
		members,
		stop: async () => {
			server.close()
			await mail.drain()
			redis.disconnect()
		},
	}
}
async function installLocalMemberData(userId: string) {
	const { crateSql } = await import("./repository.server.ts")
	const sql = crateSql("http://127.0.0.1:15748", "crate", "")
	const { goodwatchCatalog } = await import("./goodwatch.server.ts")
	const episodes = await goodwatchCatalog.episodes(1396)
	const first = episodes.find((e) => e.season === 1 && e.number === 1)
	if (!first) throw new Error("Real canonical fixture episode unavailable")
	await sql(
		`CREATE TABLE IF NOT EXISTS user_setting (user_id TEXT,key TEXT,value TEXT,PRIMARY KEY(user_id,key)) WITH (number_of_replicas=0)`,
	)
	for (const table of [
		"user_score",
		"user_wishlist",
		"user_favorite",
		"user_skipped",
		"user_not_interested",
	])
		await sql(
			`CREATE TABLE IF NOT EXISTS ${table} (user_id TEXT,tmdb_id BIGINT,media_type TEXT,score INTEGER,review TEXT,created_at TIMESTAMP,updated_at TIMESTAMP,PRIMARY KEY(user_id,tmdb_id,media_type)) WITH (number_of_replicas=0)`,
		)
	await sql(
		`CREATE TABLE IF NOT EXISTS user_watch_state (user_id TEXT,tmdb_id BIGINT,media_type TEXT,state TEXT,state_changed_at BIGINT,pass INTEGER,seen_press_group TEXT,seen_press_from TEXT,rate_prompt_dismissed_at BIGINT,seen_question TEXT,insert_token TEXT,updated_at BIGINT,PRIMARY KEY(user_id,tmdb_id,media_type)) WITH (number_of_replicas=0)`,
	)
	await sql(
		`CREATE TABLE IF NOT EXISTS user_watch_log (user_id TEXT,watch_id TEXT,tmdb_id BIGINT,media_type TEXT,episode_tmdb_id BIGINT,season_number INTEGER,episode_number INTEGER,watched_at TIMESTAMP,watched_at_precision TEXT,origin TEXT,group_id TEXT,import_id TEXT,pass INTEGER,created_at TIMESTAMP,PRIMARY KEY(user_id,watch_id)) WITH (number_of_replicas=0)`,
	)
	await sql(
		"INSERT INTO user_setting (user_id,key,value) VALUES (?,?,?) ON CONFLICT (user_id,key) DO UPDATE SET value=excluded.value",
		[userId, "country_default", "DE"],
	)
	await sql(
		"INSERT INTO user_setting (user_id,key,value) VALUES (?,?,?) ON CONFLICT (user_id,key) DO UPDATE SET value=excluded.value",
		[userId, "streaming_providers_default", "8"],
	)
	await sql(
		"INSERT INTO user_watch_state (user_id,tmdb_id,media_type,state,state_changed_at,pass,updated_at) VALUES (?,1396,'show','watching',?,1,?) ON CONFLICT (user_id,tmdb_id,media_type) DO NOTHING",
		[userId, Date.now(), Date.now()],
	)
	await sql(
		"INSERT INTO user_watch_log (user_id,watch_id,tmdb_id,media_type,episode_tmdb_id,season_number,episode_number,watched_at_precision,origin,pass,created_at) VALUES (?,?,1396,'show',?,1,1,'unknown','manual',1,?) ON CONFLICT (user_id,watch_id) DO NOTHING",
		[userId, "local-fixture-first", first.tmdbId, Date.now()],
	)
	await sql(
		"REFRESH TABLE user_setting,user_score,user_wishlist,user_favorite,user_skipped,user_not_interested,user_watch_state,user_watch_log",
	)
	const { getCrateClient, setCrateClientForTest } = await import(
		"../../utils/crate"
	)
	const original = getCrateClient()
	setCrateClientForTest({
		async execute(
			statement,
			params,
			options?: Parameters<typeof original.execute>[2],
		) {
			if (!/^\s*(SELECT|WITH)\b/i.test(statement))
				throw new Error(
					"Local member fixture permits no writes through read adapters",
				)
			if (
				!/\buser_(setting|score|wishlist|favorite|skipped|not_interested|watch_state|watch_log)\b/.test(
					statement,
				)
			)
				return original.execute(
					statement,
					params as Parameters<typeof original.execute>[1],
					options,
				)
			const response = await fetch("http://127.0.0.1:15748/_sql", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ stmt: statement, args: params ?? [] }),
			})
			const value = (await response.json()) as {
				cols: string[]
				rows: unknown[][]
				rowcount: number
				error?: unknown
			}
			if (!response.ok || value.error)
				throw new Error("Local member fixture SQL failed")
			return {
				...value,
				json: value.rows.map((row) =>
					Object.fromEntries(value.cols.map((col, i) => [col, row[i]])),
				),
			}
		},
	})
}
