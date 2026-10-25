import type { Correction } from "./corrections.ts"
import { reviewButtons } from "./review-buttons.ts"
// The staff Discord post for a feedback report (docs/implementation/feedback/README.md, "Discord"). Pure builders:
// no network, no environment. Components V2, in the look of the GoodWatch bot's cards (amber container, link buttons).
//
// Technical details follow as the first reply in the staff forum thread. Display text never carries links,
// mentions, email addresses or a member's email. Mentions are disabled on every payload.
import {
	AMBER,
	BUTTON_URL_LIMIT,
	type Component,
	IS_COMPONENTS_V2,
	componentCount,
	container,
	countryName,
	separator,
	textLength,
} from "../discord/cards.ts"
import { type FeedbackInput, safePath } from "./schema.ts"

export type FeedbackKind = FeedbackInput["kind"]
type DataReport = NonNullable<FeedbackInput["data"]>

/** What the post needs from a report. A subset of Report, so the builders don't depend on the handler. */
export interface PostReport {
	id: string
	correction?: Correction
	kind: FeedbackKind
	message: string
	data?: DataReport
	metadata: Record<string, unknown>
	memberId: string | null
	createdAt: number
	dedupeKey: string | null
	screenshot?: string
}
export interface PostOptions {
	/** Where "Open page" points: APP_ORIGIN, or https://goodwatch.app. */
	origin: string
	/** The member's public profile handle, without @. Never their name or email. */
	memberHandle?: string | null
	/** True when the screenshot rides in this message (media gallery); false when it follows as its own message. */
	screenshotInline: boolean
	interactive?: boolean
	/** Put in front of the thread name, for design tests. */
	threadPrefix?: string
}

const KINDS: Record<FeedbackKind, { emoji: string; label: string }> = {
	bug: { emoji: "🐞", label: "Bug" },
	idea: { emoji: "💡", label: "Idea" },
	data: { emoji: "🛠️", label: "Data fix" },
	contact: { emoji: "✉️", label: "Contact" },
}
export const kindLabel = (kind: FeedbackKind) => KINDS[kind].label

/** Discord limits that this post checks itself (components/reference, resources/channel). */
export const LIMITS = {
	threadName: 100,
	text: 4000,
	components: 40,
	buttonLabel: 80,
	hero: 2400,
	value: 300,
} as const
export const SCREENSHOT_NAME = "screenshot.webp"

const LINK = /https?:\/\/\S+|www\.\S+/gi
const SECRET =
	/\b(?:bearer\s+[^\s]+|(?:token|password|secret|authorization|cookie|session)(?:[_-]?(?:id|key|token))?\s*[:=]\s*[^\s&;]+)/gi
const EMAIL = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g

/**
 * Member text as Discord Markdown that renders as written: links and email addresses removed, mention and timestamp
 * syntax broken, Markdown escaped, line breaks kept (at most two in a row).
 */
export function memberText(value: string, max: number = LIMITS.hero): string {
	const clean = value
		.replace(/\r\n?/g, "\n")
		.replace(SECRET, "(secret removed)")
		.replace(LINK, "(link removed)")
		.replace(EMAIL, "(email removed)")
		// biome-ignore lint/suspicious/noControlCharactersInRegex: removing control characters is the point.
		.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim()
	// Budget the escaped representation; never cut an escape pair or surrogate pair.
	const chunks = [...clean].map((c) =>
		c === "@" ? "@​" : /[\\*_~`|>#[\]()<:-]/.test(c) ? `\\${c}` : c,
	)
	if (chunks.join("").length <= max) return chunks.join("")
	let short = ""
	for (const chunk of chunks) {
		if (short.length + chunk.length > max - 1) break
		short += chunk
	}
	return `${short.trimEnd()}…`
}
/** One line of member text: memberText without line breaks. */
const inline = (value: string, max: number) =>
	memberText(value.replace(/\s+/g, " "), max)
/** Text inside inline code: no backticks, one line, capped. */
export const code = (value: unknown, max = 120) => {
	const text = String(value ?? "")
		.replace(SECRET, "(secret removed)")
		.replace(LINK, "(link removed)")
		.replace(EMAIL, "(email removed)")
		.replace(/[`|\\<>@\[\]()\s]+/g, " ")
		.trim()
	return `\`${text.length > max ? `${text.slice(0, max - 1)}…` : text}\``
}
const ago = (ms: number) => `<t:${Math.floor(ms / 1000)}:R>`
const str = (value: unknown) => (typeof value === "string" ? value : undefined)

export function flag(country: unknown) {
	if (typeof country !== "string" || !/^[A-Z]{2}$/.test(country)) return ""
	return String.fromCodePoint(
		...[...country].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
	)
}
/** Checked in order: Edge, Opera and Vivaldi also say Chrome, and Chrome also says Safari. */
const BROWSERS: [string, RegExp][] = [
	["Edge", /Edg(?:A|iOS)?\/(\d+)/],
	["Opera", /OPR\/(\d+)/],
	["Vivaldi", /Vivaldi\/(\d+)/],
	["Firefox", /(?:Firefox|FxiOS)\/(\d+)/],
	["Chrome", /(?:Chrome|CriOS)\/(\d+)/],
	["Safari", /Version\/(\d+)[\d.]* .*Safari\//],
]
/** "Chrome 141 on macOS", "Safari 17 on iOS", or null when the agent says nothing useful. */
export function deviceName(userAgent: unknown): string | null {
	if (typeof userAgent !== "string" || !userAgent) return null
	const ua = userAgent
	const browser =
		BROWSERS.map(([name, pattern]) => {
			const version = pattern.exec(ua)?.[1]
			return version ? `${name} ${version.slice(0, 4)}` : null
		}).find(Boolean) ?? null
	const os = /iPhone|iPad|iPod/.test(ua)
		? "iOS"
		: /Android/.test(ua)
			? "Android"
			: /Windows/.test(ua)
				? "Windows"
				: /Mac OS X|Macintosh/.test(ua)
					? "macOS"
					: /CrOS/.test(ua)
						? "ChromeOS"
						: /Linux/.test(ua)
							? "Linux"
							: null
	if (!browser && !os) return null
	return [browser, os].filter(Boolean).join(" on ")
}
function screen(metadata: Record<string, unknown>) {
	const viewport = metadata.viewport as
		| { width?: number; height?: number }
		| undefined
	if (!viewport?.width || !viewport?.height) return null
	const dpr = typeof metadata.dpr === "number" ? metadata.dpr : null
	return `${viewport.width}×${viewport.height}${dpr && dpr !== 1 ? ` @${Math.round(dpr * 100) / 100}x` : ""}`
}
const shortPath = (value: unknown, max = 60) => {
	const path = str(value) ? safePath(String(value)) : undefined
	if (!path) return null
	let decoded = path
	try {
		decoded = decodeURIComponent(path)
	} catch {
		/* keep malformed escapes as text */
	}
	return code(decoded, max)
}
/** "Guest · 🇩🇪 · `/support` · en-US · dark · 2 minutes ago" */
export function contextLine(report: PostReport, handle?: string | null) {
	const m = report.metadata
	const who = report.memberId
		? handle && /^[a-z][a-z0-9_]{2,29}$/i.test(handle)
			? `Member @​${handle}`
			: "Member"
		: "Guest"
	return [
		who,
		flag(m.country),
		shortPath(m.url),
		str(m.locale) && /^[A-Za-z0-9-]{2,35}$/.test(m.locale as string)
			? (m.locale as string)
			: null,
		m.colorScheme === "dark" || m.colorScheme === "light"
			? m.colorScheme
			: null,
		ago(report.createdAt),
	]
		.filter(Boolean)
		.join(" · ")
}

// ---------- data reports ----------

const FIELD_NAMES: Record<string, string> = {
	providers: "Where to watch",
	provider: "Where to watch",
	streaming: "Where to watch",
	watch_providers: "Where to watch",
	where_to_watch: "Where to watch",
	release_date: "Release date",
	air_date: "Air date",
	first_air_date: "First air date",
	episode_title: "Episode title",
	cast: "Cast",
	crew: "Crew",
}
export function fieldName(field: string) {
	const key = field
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, "_")
	if (Object.prototype.hasOwnProperty.call(FIELD_NAMES, key))
		return FIELD_NAMES[key]
	const words = field
		.replace(SECRET, "(secret removed)")
		.replace(LINK, "(link removed)")
		.replace(EMAIL, "(email removed)")
		.replace(/[_\s.-]+/g, " ")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.trim()
	return words ? words[0].toUpperCase() + words.slice(1).toLowerCase() : "Field"
}
function id(ids: Record<string, string | number>, ...keys: string[]) {
	for (const key of keys) {
		const value = ids[key]
		if (value !== undefined && value !== "") return String(value)
	}
	return undefined
}
const tmdbId = (ids: Record<string, string | number>) => {
	const value = id(ids, "tmdb_id", "tmdbId", "tmdb", "id")
	return value && /^[1-9]\d{0,9}$/.test(value) ? value : undefined
}
const seasonNumber = (ids: Record<string, string | number>) => {
	const value = id(ids, "season_number", "seasonNumber", "season")
	return value && /^\d{1,4}$/.test(value) ? value : undefined
}
const episodeNumber = (ids: Record<string, string | number>) => {
	const value = id(ids, "episode_number", "episodeNumber", "episode")
	return value && /^\d{1,5}$/.test(value) ? value : undefined
}
/** "The Bear · Season 2 · Episode 3", or "Show 136315" without a name. */
export function entityName(data: DataReport) {
	const season = seasonNumber(data.ids)
	const episode = episodeNumber(data.ids)
	const base = data.entityName
		? inline(data.entityName, 120)
		: `${data.entityKind === "person" ? "Person" : data.entityKind === "movie" ? "Movie" : "Show"} ${tmdbId(data.ids) ?? ""}`.trim()
	return [
		base,
		(data.entityKind === "season" || data.entityKind === "episode") && season
			? `Season ${season}`
			: null,
		data.entityKind === "episode" && episode ? `Episode ${episode}` : null,
	]
		.filter(Boolean)
		.join(" · ")
}
function valueText(value: DataReport["currentValue"]) {
	if (value === undefined) return undefined
	if (value === null || value === "") return "*nothing*"
	if (typeof value === "boolean") return value ? "yes" : "no"
	return inline(String(value), LIMITS.value)
}
/** TMDB and IMDb pages for the reported entity, when its ids allow. */
export function referenceLinks(data: DataReport) {
	const links: { label: string; url: string }[] = []
	const tmdb = tmdbId(data.ids)
	const season = seasonNumber(data.ids)
	const episode = episodeNumber(data.ids)
	if (tmdb) {
		const base =
			data.entityKind === "movie"
				? `https://www.themoviedb.org/movie/${tmdb}`
				: data.entityKind === "person"
					? `https://www.themoviedb.org/person/${tmdb}`
					: `https://www.themoviedb.org/tv/${tmdb}`
		const url =
			data.entityKind === "season" && season
				? `${base}/season/${season}`
				: data.entityKind === "episode" && season && episode
					? `${base}/season/${season}/episode/${episode}`
					: base
		links.push({ label: "TMDB", url })
	}
	const imdb = id(data.ids, "imdb_id", "imdbId", "imdb")
	if (imdb && /^tt\d{5,10}$/.test(imdb))
		links.push({ label: "IMDb", url: `https://www.imdb.com/title/${imdb}/` })
	else if (imdb && /^nm\d{5,10}$/.test(imdb))
		links.push({ label: "IMDb", url: `https://www.imdb.com/name/${imdb}/` })
	return links
}
const hostname = (url: string) => {
	try {
		return new URL(url).hostname.replace(/^www\./, "")
	} catch {
		return null
	}
}
/** The "was / now" block: field and country on top (the heading names the entity), then the two values. */
export function dataBlock(data: DataReport) {
	const where = data.country
		? ` in ${countryName(data.country)} ${flag(data.country)}`
		: ""
	const lines = [`**${inline(fieldName(data.field), 200)}**${where}`]
	const was = valueText(data.currentValue)
	const now = valueText(data.suggestedValue)
	if (was !== undefined) lines.push(`> Was: ${was}`)
	if (now !== undefined) lines.push(`> Now: **${now}**`)
	if (data.providerIds?.length)
		lines.push(
			`-# Provider ids ${data.providerIds.slice(0, 10).map(String).join(", ")}`,
		)
	if (data.note) lines.push(memberText(data.note, 1000))
    if (data.target && Object.keys(data.target).length)
        lines.push(`-# Target ${code(JSON.stringify(data.target), 400)}`)
    const source = data.sourceLink && hostname(data.sourceLink)
	if (source) lines.push(`-# Source: ${inline(source, 80)}`)
	return lines.join("\n")
}

// ---------- the post ----------

const linkButton = (label: string, value: string): Component | null => {
	try {
		const url = new URL(value)
		if (!["http:", "https:"].includes(url.protocol)) return null
		// Never forward credentials, fragments, secret query parameters, or email-bearing URLs.
		url.username = ""
		url.password = ""
		const decoded = decodeURIComponent(url.href)
		if (decoded.match(EMAIL)) return null
		const clean = url.origin + safePath(url.href)
		return clean.length <= BUTTON_URL_LIMIT
			? {
					type: 2,
					style: 5,
					label: label.slice(0, LIMITS.buttonLabel),
					url: clean,
				}
			: null
	} catch {
		return null
	}
}
export function pageUrl(origin: string, path: unknown) {
	const value = str(path)
	if (!value?.startsWith("/")) return null
	try {
		const url = new URL(value, origin)
		if (url.origin !== new URL(origin).origin) return null
		return url.toString().length <= BUTTON_URL_LIMIT
			? url.toString()
			: `${url.origin}${url.pathname}`.slice(0, BUTTON_URL_LIMIT)
	} catch {
		return null
	}
}
/** Link buttons only, at most five per row. */
function buttons(
	report: PostReport,
	options: { origin: string },
): Component | null {
	const page = pageUrl(options.origin, report.metadata.url)
	const source = report.data?.sourceLink
	const row = [
		page ? linkButton("Open page", page) : null,
		...(report.data ? referenceLinks(report.data) : []).map((l) =>
			linkButton(l.label, l.url),
		),
		source
			? linkButton(`Source · ${hostname(source) ?? "link"}`, source)
			: null,
	].filter(Boolean) as Component[]
	return row.length ? { type: 1, components: row.slice(0, 5) } : null
}
/**
 * The duplicate reply's technical note, behind a spoiler. The merged submission has no row and no reply of its
 * own; its report id sits on the line above.
 */
function duplicateDetailsLine(report: PostReport) {
	const m = report.metadata
	const parts = [
		report.memberId ? `member ${code(report.memberId, 64)}` : null,
		str(m.routeId) ? `route ${code(m.routeId, 80)}` : null,
		[deviceName(m.userAgent), screen(m)].filter(Boolean).join(", ") || null,
		str(m.buildCommit)
			? `build ${code(String(m.buildCommit).slice(0, 7))}`
			: null,
		str(m.sentryReplayId) ? `replay ${code(m.sentryReplayId, 40)}` : null,
		report.dedupeKey ? `dedupe ${code(report.dedupeKey.slice(0, 12))}` : null,
		`received <t:${Math.floor(report.createdAt / 1000)}:f>`,
	].filter(Boolean)
	return `-# Details ||${parts.join(" · ")}||`
}
function hero(report: PostReport, max = LIMITS.hero as number) {
	const text = memberText(report.message, max)
	return text.endsWith("…")
		? `${text}\n-# Shortened for Discord. The full message is stored with the report.`
		: text
}
/** The forum thread's name: kind and the first words (or, for data reports, entity and field). */
export function threadName(report: PostReport, prefix = "") {
	const plain = (value: string) =>
		value
			.replace(SECRET, "")
			.replace(LINK, "")
			.replace(EMAIL, "")
			.replace(/<[^>]*>|@\S+/g, "")
			.replace(/[*_~`[\]()<>#|\\]/g, "")
			.replace(/\s+/g, " ")
			.trim()
	const label = kindLabel(report.kind)
	const subject =
		report.kind === "data" && report.data
			? `${report.data.entityName ? plain(report.data.entityName) : entityName(report.data).replace(/\\/g, "")} · ${plain(fieldName(report.data.field))}`
			: plain(report.message)
	const name = `${prefix}${label}: ${subject || report.id.slice(0, 12)}`
	return name.length > LIMITS.threadName
		? `${name.slice(0, LIMITS.threadName - 1).trimEnd()}…`
		: name
}
function finish(components: Component[]) {
	if (componentCount(components) > LIMITS.components)
		throw new Error("Discord component limit exceeded")
	if (textLength(components) > LIMITS.text)
		throw new Error("Discord text limit exceeded")
	return components
}
/** The components of a new report's post. */
export function reportComponents(report: PostReport, options: PostOptions) {
	const kind = KINDS[report.kind]
	const heading =
		report.kind === "data" && report.data
			? `### ${kind.emoji} ${kind.label} · ${entityName(report.data)}`
			: `### ${kind.emoji} ${kind.label}`
	const mainText = { type: 10, content: "" }
	const card = container(
		[
			{
				type: 10,
				content: `${heading}\n-# ${contextLine(report, options.memberHandle)}`,
			},
			separator(),
			mainText,
			report.kind === "contact" && {
				type: 10,
				content:
					"-# 📧 Also emailed to hello@goodwatch.app. Reply there to answer the sender.",
			},
			report.data && separator(false),
			report.data && { type: 10, content: dataBlock(report.data) },
			report.correction && {
				type: 10,
				content: `Correction **${report.correction.status}** · ${report.correction.op} ${report.correction.field} · Target ${code(JSON.stringify(report.correction.target), 400)}`,
			},
			!!report.screenshot &&
				options.screenshotInline && {
					type: 12,
					items: [
						{
							media: { url: `attachment://${SCREENSHOT_NAME}` },
							description: "Screenshot from the reporter",
						},
					],
				},
			!!report.screenshot &&
				!options.screenshotInline && {
					type: 10,
					content: "-# 📎 Screenshot attached in the thread",
				},
		],
		AMBER,
	)
	const row = buttons(report, options)
	const review =
		report.correction && options.interactive
			? reviewButtons(report.correction)
			: null
	const components = [
		card,
		...(row ? [row] : []),
		...(review?.components.length ? [review] : []),
	]
	mainText.content = hero(
		report,
		Math.min(LIMITS.hero, LIMITS.text - textLength(components) - 90),
	)
	return finish(components)
}
/**
 * A further submission of an open data report, as a reply in its thread: a small "+1 duplicate" note, the new
 * message, what differs (the dedupe key ignores message, current value and source), and the submission id.
 */
export function duplicateComponents(
	report: PostReport,
	count: number,
	options: Omit<PostOptions, "threadPrefix">,
) {
	const lines = [
		`**+1 duplicate** (${count} total) · ${contextLine(report, options.memberHandle)}`,
		memberText(report.message, 1000)
			.split("\n")
			.map((line) => `> ${line}`)
			.join("\n"),
	]
	const was = report.data ? valueText(report.data.currentValue) : undefined
	const source = report.data?.sourceLink && hostname(report.data.sourceLink)
	const extra = [
		was !== undefined ? `they see ${was}` : null,
		source ? `source ${inline(source, 80)}` : null,
	].filter(Boolean)
	if (extra.length) lines.push(`-# ${extra.join(" · ")}`)
	if (report.screenshot && !options.screenshotInline)
		lines.push("-# 📎 Screenshot in the next message")
	lines.push(`-# Report ${code(report.id, 64)}`)
	lines.push(duplicateDetailsLine(report))
	const sourceButton = report.data?.sourceLink
		? linkButton(
				`Source · ${hostname(report.data.sourceLink) ?? "link"}`,
				report.data.sourceLink,
			)
		: null
	return finish([
		{ type: 10, content: lines.join("\n") },
		...(report.screenshot && options.screenshotInline
			? [
					{
						type: 12,
						items: [{ media: { url: `attachment://${SCREENSHOT_NAME}` } }],
					},
				]
			: []),
		...(sourceButton ? [{ type: 1, components: [sourceButton] }] : []),
	])
}
export const MESSAGE_FLAGS = IS_COMPONENTS_V2

// ---------- the first thread reply ----------

export const SUPPRESS_NOTIFICATIONS = 1 << 12

/** Technical details available at delivery time, without a storage read or member email. */
export function detailsMessage(report: PostReport, origin: string) {
	const m = report.metadata
	const device = [deviceName(m.userAgent), screen(m)]
		.filter(Boolean)
		.join(" · ")
	const lines = [
		`**Report id** ${code(report.id, 64)}`,
		`**Member id** ${code(report.memberId ?? "Guest", 64)}`,
		str(m.url) ? `**Page** ${shortPath(m.url, 120)}` : null,
		str(m.routeId) ? `**Route** ${code(m.routeId, 80)}` : null,
		device ? `**Device and browser** ${code(device, 160)}` : null,
		str(m.userAgent) ? `**User agent** ${code(m.userAgent, 300)}` : null,
		str(m.locale) ? `**Locale** ${code(m.locale, 35)}` : null,
		str(m.colorScheme) ? `**Color scheme** ${code(m.colorScheme, 20)}` : null,
		str(m.country) ? `**Country** ${code(m.country, 35)}` : null,
		str(m.buildCommit) ? `**Build commit** ${code(m.buildCommit, 64)}` : null,
		`**Received** ${code(new Date(report.createdAt).toISOString(), 30)}`,
		str(m.sentryReplayId)
			? `**Sentry replay id** ${code(m.sentryReplayId, 40)}`
			: null,
		report.dedupeKey ? `**Dedupe key** ${code(report.dedupeKey, 64)}` : null,
	].filter(Boolean)
	const screenshot = report.screenshot
		? linkButton("Screenshot", `${origin}/api/feedback/${report.id}/screenshot`)
		: null
	return {
		flags: IS_COMPONENTS_V2 | SUPPRESS_NOTIFICATIONS,
		components: finish([
			container(
				[
					{ type: 10, content: "### 🔎 Report details" },
					separator(),
					{ type: 10, content: lines.join("\n") },
				],
				AMBER,
			),
			...(screenshot ? [{ type: 1, components: [screenshot] }] : []),
		]),
		allowed_mentions: { parse: [] },
	}
}
