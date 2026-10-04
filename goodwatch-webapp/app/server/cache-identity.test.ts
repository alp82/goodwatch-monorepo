import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import { test } from "node:test"

process.env.SUPABASE_URL = "https://testref.supabase.co"
const {
	CACHE_IDENTITY_HEADER,
	SHARED_PAGE_CACHE_CONTROL,
	KEYED_PAGE_CACHE_CONTROL,
	PRIVATE_CACHE_CONTROL,
	authCookieName,
	createAuthCookieMatcher,
	hasAuthCookie,
	requestLocale,
	getLocaleFromRequest,
	cacheIdentity,
	applyCachePolicy,
} = await import("./cache-identity.server.ts")

const request = (headers: HeadersInit = {}, method = "GET", path = "/") =>
	new Request(`https://goodwatch.test${path}`, { headers, method })
const memberCookie = "sb-testref-auth-token=forged"

test("auth cookies match exact project names and numeric chunks, irrespective of value", () => {
	for (const cookie of [
		memberCookie,
		"sb-testref-auth-token=",
		"a=b; sb-testref-auth-token.0=x",
		"sb-testref-auth-token.1=x; a=b",
	])
		assert.equal(hasAuthCookie(cookie), true, cookie)
	for (const cookie of [
		null,
		undefined,
		"",
		"sb-other-auth-token=x",
		"xsb-testref-auth-token=x",
		"other=sb-testref-auth-token=x",
		"sb-testref-auth-token.foo=x",
		"_ga=GA1.1.1.1; ph_session=x; gw_browser=1",
	])
		assert.equal(hasAuthCookie(cookie), false, String(cookie))
	assert.equal(authCookieName(), "sb-testref-auth-token")
	for (const url of ["", "not a URL"]) {
		assert.equal(authCookieName(url), null)
		const fallback = createAuthCookieMatcher(url)
		assert.equal(fallback("sb-any-project-auth-token.1="), true)
		assert.equal(fallback("xsb-any-auth-token=x"), false)
		assert.equal(fallback("a=sb-any-auth-token=x"), false)
	}
})

test("the matcher follows configuration changes and falls back when configuration is absent", () => {
	try {
		Reflect.deleteProperty(process.env, "SUPABASE_URL")
		assert.equal(authCookieName(), null)
		assert.equal(createAuthCookieMatcher()("sb-any-auth-token=x"), true)
		assert.equal(hasAuthCookie("sb-other-auth-token=x"), true)
		process.env.SUPABASE_URL = "https://other.supabase.co"
		assert.equal(hasAuthCookie(memberCookie), false)
		assert.equal(hasAuthCookie("sb-other-auth-token=x"), true)
	} finally {
		process.env.SUPABASE_URL = "https://testref.supabase.co"
	}
})

test("locale uses quality order, independent language and region, and US/en fallbacks", () => {
	for (const [header, country, language] of [
		["", "US", "en"],
		["en", "US", "en"],
		["de-DE,de;q=0.9,en;q=0.8", "DE", "de"],
		["en,de-AT;q=0.8", "AT", "en"],
		["de-DE;q=0.3,fr-CA;q=0.9,en-US;q=0.5", "CA", "fr"],
		["zh-Hant-TW,en;q=0.8", "TW", "zh"],
		["fil-PH", "PH", "fil"],
		["1234 !@#", "US", "en"],
		["garbage", "US", "en"],
		["*", "US", "en"],
	]) {
		assert.deepEqual(
			requestLocale(request({ "Accept-Language": header })),
			{
				country,
				language,
				source: "accept-language",
			},
			header,
		)
	}
	assert.deepEqual(getLocaleFromRequest(request()), {
		locale: { country: "US", language: "en" },
	})
})

test("only a valid identity header overrides Accept-Language", () => {
	assert.deepEqual(
		requestLocale(
			request({
				[CACHE_IDENTITY_HEADER]: "anon;CA;fr",
				"Accept-Language": "de-DE",
			}),
		),
		{
			country: "CA",
			language: "fr",
			source: "identity-header",
		},
	)
	for (const header of [
		"anon;us;en",
		"member",
		"anon;US",
		"anon;USA;en",
		"anon;US;EN",
		"anon;US;english",
	]) {
		assert.deepEqual(
			requestLocale(
				request({
					[CACHE_IDENTITY_HEADER]: header,
					"Accept-Language": "de-DE",
				}),
			),
			{
				country: "DE",
				language: "de",
				source: "accept-language",
			},
			header,
		)
	}
})

test("identity is memoized per request and only anonymous GET/HEAD can be cached", () => {
	const anon = request({ "Accept-Language": "en,de-AT;q=0.8" })
	assert.deepEqual(cacheIdentity(anon), {
		audience: "anon",
		country: "AT",
		language: "en",
		key: "anon;AT;en",
		keyFromCache: false,
		cacheable: true,
	})
	assert.equal(cacheIdentity(anon), cacheIdentity(anon))
	assert.equal(cacheIdentity(request({}, "HEAD")).cacheable, true)
	assert.equal(cacheIdentity(request({}, "POST")).cacheable, false)
	assert.deepEqual(
		cacheIdentity(
			request({
				Cookie: memberCookie,
				[CACHE_IDENTITY_HEADER]: "anon;CA;fr",
				"Accept-Language": "de-DE",
			}),
		),
		{
			audience: "member",
			country: "DE",
			language: "de",
			key: null,
			keyFromCache: false,
			cacheable: false,
		},
	)
})

test("policy rejects errors, other statuses, members, mutations, cookies and route restrictions", () => {
	const cases = [
		{ status: 404 },
		{ status: 500 },
		{ status: 201 },
		{ status: 204 },
		{ status: 301 },
		{ status: 304 },
		{ cookie: memberCookie },
		{ method: "POST" },
		{ method: "PUT" },
		{ method: "DELETE" },
		{ extra: { "Set-Cookie": "a=b" } },
		...[
			'private="Set-Cookie", public',
			"private",
			"public, no-store",
			"public, NO-CACHE",
		].map((policy) => ({ policy })),
	]
	for (const scenario of cases) {
		const {
			status = 200,
			method = "GET",
			cookie = "",
			policy = SHARED_PAGE_CACHE_CONTROL,
			extra = {},
		} = scenario as {
			status?: number
			method?: string
			cookie?: string
			policy?: string
			extra?: Record<string, string>
		}
		const headers = new Headers({
			"Cache-Control": policy,
			Vary: "Cookie, Accept-Language, Accept-Encoding",
			[CACHE_IDENTITY_HEADER]: "anon;US;en",
			...extra,
		})
		assert.equal(
			applyCachePolicy(
				request(
					{ Cookie: cookie, [CACHE_IDENTITY_HEADER]: "anon;US;en" },
					method,
				),
				status,
				headers,
			),
			"private",
			JSON.stringify(scenario),
		)
		assert.equal(headers.get("Cache-Control"), PRIVATE_CACHE_CONTROL)
		assert.equal(headers.get(CACHE_IDENTITY_HEADER), null)
		assert.equal(headers.get("Vary"), "Accept-Encoding")
	}
	for (const vary of ["Cookie, Accept-Language", "cookie", ""]) {
		const headers = new Headers({ Vary: vary })
		applyCachePolicy(request(), 404, headers)
		assert.equal(headers.get("Vary"), null)
	}
})

test("anonymous allowed responses are keyed or shared, with no Cookie in Vary", () => {
	for (const method of ["GET", "HEAD"]) {
		for (const fromCache of [false, true]) {
			const headers = new Headers({
				"Cache-Control": SHARED_PAGE_CACHE_CONTROL,
				Vary: "Cookie, Accept-Language",
			})
			const reqHeaders = new Headers({
				"Accept-Language": "en-US",
				Cookie: "_ga=x; gw_browser=1",
			})
			if (fromCache) reqHeaders.set(CACHE_IDENTITY_HEADER, "anon;CA;fr")
			assert.equal(
				applyCachePolicy(request(reqHeaders, method), 200, headers),
				fromCache ? "shared" : "keyed",
			)
			assert.equal(
				headers.get("Cache-Control"),
				fromCache ? SHARED_PAGE_CACHE_CONTROL : KEYED_PAGE_CACHE_CONTROL,
			)
			assert.equal(
				headers.get("Vary"),
				fromCache ? CACHE_IDENTITY_HEADER : "Accept-Language",
			)
			assert.equal(
				headers.get(CACHE_IDENTITY_HEADER),
				fromCache ? "anon;CA;fr" : "anon;US;en",
			)
		}
	}
})

test("leaf data responses stay unset for anonymous requests, but private for members", () => {
	for (const keyed of [false, true]) {
		const headers = new Headers({
			"Content-Type": "application/json",
			Vary: "Origin",
		})
		const before = [...headers]
		assert.equal(
			applyCachePolicy(
				request(keyed ? { [CACHE_IDENTITY_HEADER]: "anon;US;en" } : {}),
				200,
				headers,
			),
			"unset",
		)
		assert.deepEqual([...headers], before)
		assert.equal(
			applyCachePolicy(request({ Cookie: memberCookie }), 200, headers),
			"private",
		)
		assert.equal(headers.get("Cache-Control"), PRIVATE_CACHE_CONTROL)
	}
})

test("member HTML is never shared across the actual route inventory", () => {
	const files = readdirSync(new URL("../routes/", import.meta.url)).filter(
		(file) => /\.tsx?$/.test(file) && !/^(prototype|dev|api)\./.test(file),
	)
	assert.ok(files.length >= 30)
	for (const route of [
		"_index",
		"movie.$movieKey",
		"show.$showKey",
		"person.$personKey",
		"u.$handle.lists.$id",
		"discover.($type)",
	])
		assert.ok(
			files.some((file) => file.replace(/\.tsx?$/, "") === route),
			route,
		)
	for (const file of files) {
		const path = `/${file
			.replace(/\.tsx?$/, "")
			.split(".")
			.filter((part) => !part.startsWith("_"))
			.map((part) =>
				part.replace(/[()]/g, "").replace(/_$/, "").replace(/\$\w*/g, "sample"),
			)
			.join("/")}`
		for (const status of [200, 404, 500]) {
			for (const keyed of [false, true]) {
				const reqHeaders = new Headers({ Cookie: memberCookie })
				if (keyed) reqHeaders.set(CACHE_IDENTITY_HEADER, "anon;US;en")
				const headers = new Headers({
					"Cache-Control": SHARED_PAGE_CACHE_CONTROL,
				})
				assert.equal(
					applyCachePolicy(request(reqHeaders, "GET", path), status, headers),
					"private",
					`${file}: ${status}, keyed=${keyed}`,
				)
				assert.equal(headers.get("Cache-Control"), PRIVATE_CACHE_CONTROL)
				assert.equal(headers.get(CACHE_IDENTITY_HEADER), null)
				assert.equal(headers.get("Vary"), null)
			}
		}
	}
})
