// The profile's Taste tab data in one shape for its components: the taste portrait's three views (fingerprint, taste
// groups, you vs everyone) joined, titles keyed "movie-550" as ProfileTitle, every attribute with its emoji; plus the
// family colours, tier words and small formatters. buildProfileTaste runs in the loader; the rest is browser-safe.
import { createContext, useContext } from "react"
import type { ProfileTitle } from "~/domain/profile"
import type { MemberCompare, TasteStats } from "~/domain/profile-taste"
import type { TitleKind } from "~/domain/taste-attributes"
import type {
	EveryoneGap,
	EveryoneView,
	FamilyId,
	FingerprintAttribute,
	FingerprintView,
	PortraitTitle,
	SidesView,
	Tier,
} from "~/server/taste-portrait/view"
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"
import { titlePath } from "~/utils/helpers"
import { type TitleKey, parseTitleKey } from "~/utils/title-key"

export type { FamilyId, Tier }
export type Kind = TitleKind
export { CRAFT_KEYS, FAMILY_NAMES } from "~/domain/taste-attributes"
export { TIER_NAMES } from "~/server/taste-portrait/view"

export interface TasteAttribute
	extends Omit<FingerprintAttribute, "carriers" | "against" | "exception"> {
	emoji: string
	carriers: string[]
	against: string[]
	exception: string | null
}

export interface TasteTitle extends ProfileTitle {
	anime: boolean
}

export interface CrowdRow {
	key: string
	mine: number
	/** GoodWatch score, 0 to 100. */
	everyone: number
	delta: number
	kind: Kind
}

export interface ProfileTaste {
	status: "ready" | "empty" | "unavailable"
	usual: number | null
	counted: number
	identity: { name: string; keys: string[] } | null
	line: string
	seek: string[]
	avoid: string[]
	families: { id: FamilyId; name: string; line: string; keys: string[] }[]
	attributes: TasteAttribute[]
	mostYou: string[]
	sides: {
		status: "ready" | "empty" | "unavailable"
		headline: { first: string; second: string } | null
		list: {
			id: string
			name: string
			attributes: { key: string; label: string }[]
			count: number
			average: number
			here: string[]
		}[]
	}
	crowd: {
		status: "ready" | "empty" | "unavailable"
		headline: string
		agreement: number
		offset: number
		counted: number
		higher: CrowdRow[]
		lower: CrowdRow[]
		attributes: EveryoneGap[]
		genres: EveryoneGap[]
	}
	titles: Record<string, TasteTitle>
}

const keyOf = (key: TitleKey) => {
	const { mediaType, tmdbId } = parseTitleKey(key)
	return `${mediaType}-${tmdbId}`
}

function toTitle(t: PortraitTitle): TasteTitle {
	return {
		key: `${t.mediaType}-${t.tmdbId}`,
		mediaType: t.mediaType,
		tmdbId: t.tmdbId,
		title: t.title,
		year: t.year,
		poster: t.poster,
		backdrop: t.backdrop,
		href: titlePath(t.mediaType, t.tmdbId, t.title),
		score: t.mine,
		gw: t.score,
		date: null,
		anime: t.anime,
	}
}

/** The three portrait views as the Taste tab's one shape. Runs in the loader. */
export function buildProfileTaste(
	fingerprint: FingerprintView,
	sides: SidesView,
	everyone: EveryoneView,
): ProfileTaste {
	const titles: Record<string, TasteTitle> = {}
	for (const view of [fingerprint, sides, everyone])
		for (const t of Object.values(view.titles ?? {}))
			titles[`${t.mediaType}-${t.tmdbId}`] = toTitle(t)
	const kindOf = (key: TitleKey): Kind => {
		const t = titles[keyOf(key)]
		return t?.anime ? "anime" : (t?.mediaType ?? parseTitleKey(key).mediaType)
	}
	// The everyone view measures gaps on the 0 to 100 GoodWatch scale; the profile shows points out of 10.
	const inPoints = (g: EveryoneGap): EveryoneGap => ({ ...g, delta: g.delta / 10 })
	const crowdRow = (r: EveryoneView["higher"][number]): CrowdRow => ({
		key: keyOf(r.key),
		mine: r.mine,
		everyone: r.everyone,
		delta: r.delta / 10,
		kind: kindOf(r.key),
	})
	return {
		status: fingerprint.status,
		usual: fingerprint.subject.usual,
		counted: fingerprint.subject.rated,
		identity: fingerprint.identity,
		line: fingerprint.line,
		seek: fingerprint.seek,
		avoid: fingerprint.avoid,
		families: fingerprint.families.map((f) => ({
			id: f.id,
			name: f.name,
			line: f.line,
			keys: f.keys,
		})),
		attributes: fingerprint.attributes.map((a) => ({
			...a,
			emoji: FINGERPRINT_META[a.key]?.emoji ?? "",
			carriers: a.carriers.map(keyOf),
			against: a.against.map(keyOf),
			exception: a.exception == null ? null : keyOf(a.exception),
		})),
		mostYou: fingerprint.mostYou.map(keyOf),
		sides: {
			status: sides.status,
			headline: sides.headline,
			list: (sides.sides ?? []).map((s) => ({
				id: s.id,
				name: s.name,
				attributes: s.attributes,
				count: s.count,
				average: s.average,
				here: s.here.map(keyOf),
			})),
		},
		crowd: {
			status: everyone.status,
			headline: everyone.headline ?? "",
			agreement: everyone.agreement ?? 0,
			offset: (everyone.offset ?? 0) / 10,
			counted: everyone.counted ?? 0,
			higher: (everyone.higher ?? []).map(crowdRow),
			lower: (everyone.lower ?? []).map(crowdRow),
			attributes: (everyone.attributes ?? []).map(inPoints),
			genres: (everyone.genres ?? []).map(inPoints),
		},
		titles,
	}
}

// ---------- Browser side ----------

export const FAMILY_COLOR: Record<FamilyId, string> = {
	feel: "#fb7185",
	humor: "#facc15",
	world: "#38bdf8",
	story: "#a78bfa",
	craft: "#34d399",
}
export const FAMILY_ORDER: FamilyId[] = [
	"feel",
	"humor",
	"world",
	"story",
	"craft",
]

export const TIER_NAMES_THEY: Record<Tier, string> = {
	3: "Defining",
	2: "They seek it",
	1: "They lean toward it",
	0: "Neither here nor there",
	[-1]: "They lean away",
	[-2]: "They avoid it",
	[-3]: "They steer clear",
}

export const signed = (n: number, digits = 1) =>
	`${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(digits)}`
export const pct = (n: number) => `${Math.round(n * 100)}%`
export const money = (n: number) =>
	n >= 1e9
		? `$${(n / 1e9).toFixed(1)} billion`
		: n >= 1e6
			? `$${Math.round(n / 1e6)} million`
			: `$${n.toLocaleString("en-US")}`
export const flag = (code: string) =>
	code.length === 2
		? String.fromCodePoint(
				...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)),
			)
		: ""

/** "Show you X, and you're in." in the third person. */
export const theirLine = (line: string) =>
	line.replace(/^Show you/, "Show them").replace("you're in", "they're in")

// ---------- Context ----------

export interface TasteContextValue {
	taste: ProfileTaste
	stats: TasteStats | null
	/** The signed-in visitor's comparison, when ready. */
	compare: Extract<MemberCompare, { status: "ready" }> | null
	handle: string
	owner: boolean
	attributeByKey: Map<string, TasteAttribute>
	/** A title the views refer to; a placeholder when missing. */
	title: (key: string) => TasteTitle
}

export const TasteContext = createContext<TasteContextValue | null>(null)

export function useTaste() {
	const value = useContext(TasteContext)
	if (!value) throw new Error("useTaste outside the Taste tab")
	return value
}

export function tasteContextValue(
	taste: ProfileTaste,
	stats: TasteStats | null,
	compare: MemberCompare | null,
	handle: string,
	owner: boolean,
): TasteContextValue {
	const attributeByKey = new Map(taste.attributes.map((a) => [a.key, a]))
	const title = (key: string): TasteTitle => {
		const known = taste.titles[key]
		if (known) return known
		const [mediaType, id] = key.split("-") as ["movie" | "show", string]
		const tmdbId = Number(id)
		return {
			key,
			mediaType,
			tmdbId,
			title: "",
			year: null,
			poster: null,
			backdrop: null,
			href: `/${mediaType}/${tmdbId}`,
			score: null,
			gw: null,
			date: null,
			anime: false,
		}
	}
	return {
		taste,
		stats,
		compare: compare?.status === "ready" ? compare : null,
		handle,
		owner,
		attributeByKey,
		title,
	}
}
