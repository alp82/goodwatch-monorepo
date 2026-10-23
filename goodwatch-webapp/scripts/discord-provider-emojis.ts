// Streaming service logos as Discord application emojis, so "Where to watch" shows logos instead of a list of names.
//
//   node scripts/discord-provider-emojis.ts --select     read Crate (SELECT only) and rewrite the committed map
//   node scripts/discord-provider-emojis.ts              build the upload payload from the committed map
//
// --select ranks the services by how often they appear in the availability of the countries with the most offers
// (--countries=30), groups only explicitly aliased provider IDs, and keeps the first --limit=300 services. It
// writes app/server/discord/provider-emojis.ts: one emoji per brand with its TMDB logo, every provider ID of the brand
// mapped to that emoji, and each provider's site order. Needs CRATE_HOSTS, CRATE_PORT, CRATE_USER, CRATE_PASS.
//
// Without --select, the script downloads each logo from TMDB (w92), renders it to a 128 by 128 PNG with rounded
// corners, and writes scripts/discord-emojis/provider-emojis.payload.json: [{ name, image: "data:image/png;base64,…" }],
// the body of Discord's "Create Application Emoji" call for each entry. No Discord call happens here. The bot resolves
// emoji names to IDs at runtime (app/server/discord/emoji.server.ts).
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Resvg } from "@resvg/resvg-js"
import { PROVIDER_EMOJIS } from "../app/server/discord/provider-emojis.ts"
import { SCORE_EMOJI_NAMES } from "../app/server/discord/score-emoji.ts"
import { providerIdentity } from "../app/server/discord/provider-aliases.ts"

const here = dirname(fileURLToPath(import.meta.url))
const mapFile = join(here, "../app/server/discord/provider-emojis.ts")
const payloadFile = join(here, "discord-emojis/provider-emojis.payload.json")

const arg = (name: string, fallback: number) => {
	const value = process.argv.find((a) => a.startsWith(`--${name}=`))
	return value ? Number(value.split("=")[1]) : fallback
}

/**
 * "HBO Max" → "HBOMax", "Disney+" → "DisneyPlus", "Canal+ Séries" → "CanalPlusSeries": letters and digits only, each
 * word capitalized, at most 32 characters. Hover shows this name, so it has no underscores.
 */
export function emojiName(name: string) {
	const words = name
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.replace(/\+/g, " Plus ")
		.replace(/&/g, " And ")
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
	const joined = words.map((w) => w[0].toUpperCase() + w.slice(1)).join("")
	return joined.slice(0, 32)
}

interface Service {
	id: number
	name: string
	logo_path: string | null
	order_default: number | null
}

async function select() {
	const { query } = await import("../app/utils/crate.ts")
	const since = Date.now() - 30 * 24 * 3600 * 1000
	const countries = (
		await query<{ country_code: string; n: number }>(
			"SELECT country_code, count(*) AS n FROM streaming_availability WHERE updated_at > ? GROUP BY country_code ORDER BY n DESC LIMIT ?",
			[since, arg("countries", 30)],
		)
	).map((row) => row.country_code)
	const counts = new Map(
		(
			await query<{ id: number; n: number }>(
				`SELECT streaming_service_id AS id, count(*) AS n FROM streaming_availability WHERE updated_at > ? AND country_code IN (${countries
					.map(() => "?")
					.join(",")}) GROUP BY streaming_service_id`,
				[since, ...countries],
			)
		).map((row) => [row.id, row.n]),
	)
	const services = await query<Service>(
		"SELECT tmdb_id AS id, name, logo_path, order_default FROM streaming_service",
	)
	const brands = new Map<
		number,
		{ name: string; n: number; members: Service[] }
	>()
	for (const service of services) {
		if (!service.name?.trim()) continue
		const identity = providerIdentity(service.id, service.name)
		const entry = brands.get(identity.id!) ?? {
			name: identity.name,
			n: 0,
			members: [],
		}
		entry.n += counts.get(service.id) ?? 0
		entry.members.push(service)
		brands.set(identity.id!, entry)
	}
	const taken = new Set(SCORE_EMOJI_NAMES.map((n) => n.toLowerCase()))
	const emojis: { name: string; brand: string; logo: string; count: number }[] =
		[]
	const providers: Record<number, string> = {}
	for (const [baseId, entry] of [...brands].sort((a, b) => b[1].n - a[1].n)) {
		const brand = entry.name
		if (emojis.length >= arg("limit", 300) || entry.n === 0) break
		// Prefer the base service's own logo, then the most offered verified alias.
		const side = (m: Service) => Number(m.id !== baseId)
		const lead = [...entry.members]
			.filter((m) => m.logo_path)
			.sort(
				(a, b) =>
					side(a) - side(b) ||
					(counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0),
			)[0]
		if (!lead?.logo_path) continue
		// The full name reads better on hover than the short label ("AmazonPrimeVideo", not "Prime").
		const baseName = emojiName(brand)
		let name = baseName
		if (name.length < 2) continue
		// Distinct services may have the same spelling. Keep their identities and logos separate.
		let variant = 0
		while (taken.has(name.toLowerCase())) {
			const suffix = `Logo${String.fromCharCode(
				65 + Math.floor(variant / 26),
				65 + (variant % 26),
			)}`
			name = `${baseName.slice(0, 32 - suffix.length)}${suffix}`
			variant++
		}
		taken.add(name.toLowerCase())
		emojis.push({ name, brand, logo: lead.logo_path, count: entry.n })
		for (const m of entry.members) providers[m.id] = name
	}
	const order = Object.fromEntries(
		services
			.filter((s) => providers[s.id] && typeof s.order_default === "number")
			.map((s) => [s.id, s.order_default]),
	)
	writeFileSync(
		mapFile,
		`// Generated by scripts/discord-provider-emojis.ts --select on ${new Date()
			.toISOString()
			.slice(0, 10)} from the availability of ${
			countries.length
		} countries (${countries.join(", ")}).
// Streaming service logos as application emojis, ranked by how often each brand is offered. Don't edit by hand.

/** One emoji per brand: its name on Discord, the brand as the site shows it, and the TMDB logo it is made from. */
export const PROVIDER_EMOJIS: readonly { name: string; brand: string; logo: string }[] = ${JSON.stringify(
			emojis.map(({ name, brand, logo }) => ({ name, brand, logo })),
			null,
			"\t",
		)}

/** Provider ID to emoji name, for every provider of each brand above. */
export const PROVIDER_EMOJI_BY_ID: Readonly<Record<number, string>> = ${JSON.stringify(
			providers,
		)}

/** Provider ID to the site's default provider order (lower first). */
export const PROVIDER_ORDER: Readonly<Record<number, number>> = ${JSON.stringify(
			order,
		)}
`,
	)
	console.log(
		`Wrote ${emojis.length} provider emojis for ${
			Object.keys(providers).length
		} providers to ${mapFile}`,
	)
}

/** A logo at 128 by 128 with rounded corners, the way the site shows service logos. */
export function logoSvg(image: string, mime: string) {
	return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="128" height="128" viewBox="0 0 128 128">
<defs><clipPath id="r"><rect x="4" y="4" width="120" height="120" rx="26"/></clipPath></defs>
<g clip-path="url(#r)"><image x="4" y="4" width="120" height="120" preserveAspectRatio="xMidYMid slice" xlink:href="data:${mime};base64,${image}"/></g>
</svg>`
}

async function payload() {
	mkdirSync(dirname(payloadFile), { recursive: true })
	const out: { name: string; image: string }[] = []
	const queue = [...PROVIDER_EMOJIS]
	const failed: string[] = []
	await Promise.all(
		Array.from({ length: 8 }, async () => {
			for (let e = queue.shift(); e; e = queue.shift()) {
				try {
					const response = await fetch(
						`https://image.tmdb.org/t/p/w92${e.logo}`,
						{ signal: AbortSignal.timeout(15_000) },
					)
					if (!response.ok) throw new Error(`TMDB status ${response.status}`)
					const mime = response.headers.get("content-type") ?? "image/jpeg"
					const bytes = Buffer.from(await response.arrayBuffer())
					const png = new Resvg(logoSvg(bytes.toString("base64"), mime), {
						fitTo: { mode: "width", value: 128 },
					})
						.render()
						.asPng()
					out.push({
						name: e.name,
						image: `data:image/png;base64,${png.toString("base64")}`,
					})
				} catch (error) {
					failed.push(
						`${e.name}: ${error instanceof Error ? error.message : error}`,
					)
				}
			}
		}),
	)
	const rank = new Map(PROVIDER_EMOJIS.map((e, i) => [e.name, i]))
	out.sort((a, b) => (rank.get(a.name) ?? 0) - (rank.get(b.name) ?? 0))
	writeFileSync(payloadFile, JSON.stringify(out))
	console.log(`Wrote ${out.length} provider emojis to ${payloadFile}`)
	for (const line of failed) console.error(`Skipped ${line}`)
	if (process.argv.includes("--png")) {
		const folder = join(dirname(payloadFile), "providers")
		mkdirSync(folder, { recursive: true })
		for (const e of out)
			writeFileSync(
				join(folder, `${e.name}.png`),
				Buffer.from(e.image.split(",")[1], "base64"),
			)
		console.log(`Wrote PNG previews to ${folder}`)
	}
}

try {
	await (process.argv.includes("--select") ? select() : payload())
	process.exit(0)
} catch (error) {
	console.error(
		error instanceof Error ? error.message : "Provider emoji script failed",
	)
	process.exit(1)
}
