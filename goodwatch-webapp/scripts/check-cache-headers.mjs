// Checks the cache headers of a running webapp against docs/cache-identity.md: member HTML is never shared-cacheable,
// errors are never stored, and anonymous pages name their cache identity instead of varying on Cookie.
//   node scripts/check-cache-headers.mjs <base-url> [--list <path of a public share list>]
// The member requests carry a forged auth cookie. Never log the project ref, the cookie, or the share list's path.
const [baseUrl, ...options] = process.argv.slice(2)
if (
	!baseUrl ||
	(options.length &&
		(options.length !== 2 ||
			options[0] !== "--list" ||
			!options[1].startsWith("/")))
) {
	console.error(
		"Usage: node scripts/check-cache-headers.mjs <base-url> [--list <path>]",
	)
	process.exit(1)
}

const browserHeaders = {
	"User-Agent":
		"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
	"Accept-Language": "en-US",
}
const identity = "anon;US;en"
const keyedPolicy = "private, max-age=0"
const privatePolicy = "private, no-store"
const headerHas = (value, directive) =>
	value
		.toLowerCase()
		.split(",")
		.some((part) => part.trim().split("=")[0] === directive)

async function get(path, headers = {}) {
	return fetch(new URL(path, baseUrl), {
		redirect: "manual",
		headers: { ...browserHeaders, ...headers },
		signal: AbortSignal.timeout(30_000),
	})
}

async function main() {
	const initial = await get("/")
	// Remix may embed the loader JSON directly or inside an escaped JSON string.
	const html = (await initial.text()).replace(/\\"/g, '"')
	const ref = html.match(
		/"SUPABASE_URL"\s*:\s*"https:\/\/([a-zA-Z0-9-]+)\.supabase\.co\/?"/,
	)?.[1]
	if (!ref) throw new Error("Missing public configuration")
	const memberCookie = `sb-${ref}-auth-token=forged; gw_browser=1`
	const variants = [
		{ name: "anon", headers: {} },
		{
			name: "anon cookies",
			headers: { Cookie: "_ga=GA1.1.1.1; gw_browser=1" },
		},
		{
			name: "anon identity",
			headers: { "GW-Cache-Identity": identity },
			keyed: true,
		},
		{ name: "member", headers: { Cookie: memberCookie }, member: true },
		{
			name: "member identity",
			headers: { Cookie: memberCookie, "GW-Cache-Identity": identity },
			member: true,
			keyed: true,
		},
	]
	const paths = [
		"/",
		"/movie/603-the-matrix",
		"/show/1396-breaking-bad",
		"/person/6384-keanu-reeves",
		"/discover",
	]
	if (options.length) paths.push(options[1])
	paths.push(
		"/movie/999999999-nothing",
		"/person/999999999-nothing",
		"/this/does/not/exist",
	)
	let failed = false
	for (const path of paths) {
		for (const variant of variants) {
			const response = await get(path, variant.headers)
			const control = response.headers.get("cache-control") ?? ""
			const vary = response.headers.get("vary") ?? ""
			const key = response.headers.get("gw-cache-identity") ?? ""
			// The share list's path holds a handle: it isn't printed.
			const label = path === options[1] ? "<share list>" : path
			console.log(
				`${label} (${variant.name}): ${response.status} | ${control || "-"} | ${vary || "-"} | ${key || "-"}`,
			)
			const errors = []
			if (![403, 410].includes(response.status) && headerHas(vary, "cookie"))
				errors.push("Vary contains Cookie")
			if (variant.member && !headerHas(control, "private"))
				errors.push("member response is not private")
			if (response.status >= 400 && !headerHas(control, "no-store"))
				errors.push("error response lacks no-store")
			if (path === options[1] && variant.member) {
				if (control !== privatePolicy)
					errors.push("share list is not private, no-store")
			} else if (!variant.member && response.status === 200) {
				if (variant.keyed) {
					if (path === options[1]) {
						const seconds = (directive) => {
							const match = new RegExp(
								`(?:^|,)\\s*${directive}=(\\d+)\\s*(?:,|$)`,
								"i",
							).exec(control)
							return match ? Number(match[1]) : NaN
						}
						if (
							!headerHas(control, "public") ||
							!(seconds("s-maxage") <= 10) ||
							!(seconds("stale-while-revalidate") <= 10) ||
							headerHas(control, "stale-if-error")
						)
							errors.push("share list exceeds its public lifetime")
					}
					if (
						!headerHas(control, "s-maxage") ||
						!headerHas(vary, "gw-cache-identity")
					)
						errors.push("identity response lacks shared policy or Vary")
				} else if (control !== keyedPolicy || key !== identity) {
					errors.push("anonymous response lacks keyed policy or identity")
				}
			}
			for (const error of errors)
				console.error(`FAIL ${label} (${variant.name}): ${error}`)
			failed ||= errors.length > 0
			await response.body?.cancel()
		}
	}
	if (failed) process.exitCode = 1
}

main().catch(() => {
	// Fetch errors may include request details. Keep credentials out of diagnostics.
	console.error(
		"Cache header check could not finish. Check the base URL, connectivity, and embedded SUPABASE_URL.",
	)
	process.exitCode = 1
})
