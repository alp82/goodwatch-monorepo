// Compare warmed loader responses on two loopback production builds.
// Usage: node member-loads.mjs beforeOrigin afterOrigin cookieFile outputFile
import fs from "node:fs/promises"
const [beforeOrigin, afterOrigin, cookieFile, outputFile] =
	process.argv.slice(2)
if (!beforeOrigin || !afterOrigin || !cookieFile || !outputFile)
	throw Error(
		"Expected two loopback origins, a Cookie header file, and an output file",
	)
for (const origin of [beforeOrigin, afterOrigin]) {
	const url = new URL(origin)
	if (
		url.protocol !== "http:" ||
		!["127.0.0.1", "localhost"].includes(url.hostname) ||
		url.username ||
		url.password
	)
		throw Error("Loopback HTTP origins required")
}
const cookie = (await fs.readFile(cookieFile, "utf8")).trim()
if (!cookie.includes("session_token"))
	throw Error("Expected a local member Cookie header")
for (const origin of [beforeOrigin, afterOrigin]) {
	const response = await fetch(origin + "/api/auth/get-session", {
		headers: { Cookie: cookie },
	})
	const session = await response.json()
	if (!response.ok || !session?.user?.id)
		throw Error("Local member session is missing or revoked")
}
const routes = [
	["/movie/603-the-matrix", "routes/movie.$movieKey"],
	["/show/1399-game-of-thrones", "routes/show.$showKey"],
	["/movies/best", "routes/$type.best"],
	["/discover", "routes/discover.($type)"],
	["/my-library/want", "routes/my-library.$list"],
	["/taste", "routes/taste._index"],
]
const rows = []
for (const [path, route] of routes)
	for (const member of [false, true]) {
		const headers = {
			"User-Agent":
				"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
			"Accept-Language": "en-US,en;q=0.9",
			Cookie: "gw_browser=1" + (member ? "; " + cookie : ""),
		}
		const url = path + "?_data=" + encodeURIComponent(route)
		for (let i = 0; i < 23; i++)
			for (const [name, origin] of [
				["before", beforeOrigin],
				["after", afterOrigin],
			]) {
				const start = performance.now()
				const res = await fetch(origin + url, { headers })
				const body = await res.text()
				const ms = performance.now() - start
				if (res.status !== 200)
					throw Error(
						`${path} ${name} ${res.status} ${res.headers.get("x-remix-redirect")} ${body.slice(0, 100)}`,
					)
				if (i >= 3)
					rows.push({
						path,
						route,
						member,
						name,
						ms,
						status: res.status,
						bytes: body.length,
						timing: res.headers.get("server-timing"),
						cache: res.headers.get("cache-control"),
					})
			}
		await fs.writeFile(outputFile, JSON.stringify(rows, null, 2))
		console.log(
			path,
			member ? "member" : "anon",
			...["before", "after"].map((name) => {
				const a = rows
					.filter(
						(r) => r.path === path && r.member === member && r.name === name,
					)
					.map((r) => r.ms)
					.sort((a, b) => a - b)
				return name + ": " + ((a[9] + a[10]) / 2).toFixed(2)
			}),
		)
	}
