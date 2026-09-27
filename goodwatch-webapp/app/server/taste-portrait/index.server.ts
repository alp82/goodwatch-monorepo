// The Taste page's portrait: one view model per tab (Sides of you, You vs everyone, Fingerprint), computed from the
// person's ratings, the title snapshot, and the catalog statistics. It reads no people or credits: the only Crate reads
// are the viewer context (the person's own rows) and the display fields of the titles a view shows.
//
// - Members: cached in Redis per person and tab for 10 minutes, cleared by markTasteChanged (see cache.server.ts).
// - Guests with at least 5 guest ratings: computed from their guest ratings, kept in process for 10 minutes per
//   distinct set of guest progress.
// - Guests with fewer: the sample taste (sample-ratings.ts), labeled as such, kept in process for 6 hours.
// - Too few ratings for a tab: that tab's empty state, never an error.
import { createHash } from "node:crypto"
import { isOnServices } from "~/server/availability-index.server"
import { type Taste, loadTaste } from "~/server/taste/index.server"
import { getCardServices, getServiceList } from "~/server/title-cards.server"
import {
	type TitleSnapshot,
	getTitleSnapshot,
} from "~/server/title-snapshot/index.server"
import {
	type GuestProgress,
	type Viewer,
	type ViewerContext,
	getViewerContext,
} from "~/server/viewer.server"
import type { TasteInteraction } from "~/ui/taste/types"
import { getUserIdFromRequest } from "~/utils/auth"
import { type TitleKey, parseTitleKey, titleKey } from "~/utils/title-key"
import { readCachedPortrait, writeCachedPortrait } from "./cache.server"
import { titleDisplays } from "./display.server"
import { buildEveryone } from "./everyone.server"
import { FAMILIES } from "./families.server"
import { buildFingerprint } from "./fingerprint.server"
import { type PortraitInput, readPerson, round1 } from "./person.server"
import { SAMPLE_RATINGS, SAMPLE_WANT_TO_SEE } from "./sample-ratings"
import { buildSides } from "./sides.server"
import {
	GUEST_MIN_RATINGS,
	type PortraitSubject,
	type PortraitTab,
	type PortraitTitle,
	type PortraitView,
	type PortraitViewOf,
} from "./view"

export { clearTastePortrait } from "./cache.server"
export * from "./view"

/** Reasons per suggestion, as title cards show them. */
const CARD_REASONS = 2
const GUEST_KEEP_MS = 10 * 60_000
const SAMPLE_KEEP_MS = 6 * 60 * 60_000
const MAX_KEPT = 500

/** Who asks for a portrait. The viewer context is read only when no cached view answers. */
export interface PortraitViewer {
	viewer: Viewer
	context(): Promise<ViewerContext>
}

/** The viewer of a request: a signed-in member, or a guest with the guest progress their browser sent. */
export async function portraitViewer(
	request: Request,
	guest?: GuestProgress,
	// The signed-in member's id when the caller has already read it (null for a guest), to skip a second auth check.
	knownUserId?: string | null,
): Promise<PortraitViewer> {
	const userId =
		knownUserId === undefined
			? ((await getUserIdFromRequest({ request })) ?? null)
			: knownUserId
	return {
		viewer: userId
			? { kind: "member", userId }
			: { kind: "guest", progress: guest ?? { interactions: [] } },
		context: () => getViewerContext(request, guest, userId),
	}
}

/** One tab's view. With the title snapshot not loaded yet (right after a start), the view is "unavailable". */
export async function getTastePortrait<T extends PortraitTab>(
	who: PortraitViewer,
	tab: T,
): Promise<PortraitViewOf<T>> {
	const snapshot = getTitleSnapshot()
	if (!snapshot) return unavailable(tab, who.viewer.kind) as PortraitViewOf<T>
	const view =
		who.viewer.kind === "member"
			? await memberPortrait(who.viewer.userId, who, tab, snapshot)
			: await guestPortrait(who, tab, snapshot)
	return view as PortraitViewOf<T>
}

// ---------- members ----------

async function memberPortrait(
	userId: string,
	who: PortraitViewer,
	tab: PortraitTab,
	snapshot: TitleSnapshot,
): Promise<PortraitView> {
	const cached = await readCachedPortrait(userId, tab)
	if (cached) return cached
	const readFrom = Date.now()
	const [ctx, taste] = await Promise.all([who.context(), loadTaste(who.viewer)])
	const input = inputOf("member", ctx, taste)
	const view = await buildView(snapshot, input, tab)
	// While the person's country loads into the availability index, On my services can't be told yet: keep that view
	// for a minute only.
	writeCachedPortrait(
		userId,
		view,
		readFrom,
		availabilityLoading(input) ? 60 : undefined,
	)
	return view
}

// ---------- guests ----------

const kept = new Map<string, { until: number; view: Promise<PortraitView> }>()

function keep(
	id: string,
	keepMs: number,
	build: () => Promise<PortraitView>,
): Promise<PortraitView> {
	const now = Date.now()
	const hit = kept.get(id)
	if (hit && hit.until > now) return hit.view
	const view = build()
	kept.delete(id)
	kept.set(id, { until: now + keepMs, view })
	view.catch(() => kept.delete(id))
	for (const [key, entry] of kept) {
		if (entry.until > now && kept.size <= MAX_KEPT) break
		kept.delete(key)
	}
	return view
}

async function guestPortrait(
	who: PortraitViewer,
	tab: PortraitTab,
	snapshot: TitleSnapshot,
): Promise<PortraitView> {
	const ctx = await who.context()
	const where = [ctx.country, [...ctx.services].sort().join(",")]
	if (ctx.ratings.size >= GUEST_MIN_RATINGS) {
		const id = createHash("sha256")
			.update(
				JSON.stringify([
					snapshot.version,
					tab,
					where,
					[...ctx.ratings].sort((a, b) => a[0] - b[0]),
					[...ctx.seen].sort(),
					[...ctx.wishlist.keys()].sort(),
					[...ctx.skipped].sort(),
				]),
			)
			.digest("base64url")
		return keep(`guest:${id}`, GUEST_KEEP_MS, async () => {
			const taste = await loadTaste(ctx.viewer)
			return buildView(snapshot, inputOf("guest", ctx, taste), tab)
		})
	}
	// The sample taste depends only on the snapshot and where the guest watches.
	return keep(
		`sample:${snapshot.version}:${tab}:${where.join(":")}`,
		SAMPLE_KEEP_MS,
		async () => {
			const sample = sampleContext(ctx)
			const taste = await loadTaste(sample.viewer)
			return buildView(snapshot, inputOf("sample", sample, taste), tab)
		},
	)
}

const keyOf = (id: string): TitleKey => {
	const [mediaType, tmdbId] = id.split("-")
	return titleKey(mediaType as "movie" | "show", Number(tmdbId))
}

/** The sample member, seen from where the guest watches. */
function sampleContext(guest: ViewerContext): ViewerContext {
	const now = Date.now()
	const interactions: TasteInteraction[] = [
		...Object.entries(SAMPLE_RATINGS).map(([id, score]) => {
			const { mediaType, tmdbId } = parseTitleKey(keyOf(id))
			return {
				tmdb_id: tmdbId,
				media_type: mediaType,
				type: "score" as const,
				score: score as TasteInteraction["score"],
				timestamp: now,
			}
		}),
		...SAMPLE_WANT_TO_SEE.map((id) => {
			const { mediaType, tmdbId } = parseTitleKey(keyOf(id))
			return {
				tmdb_id: tmdbId,
				media_type: mediaType,
				type: "plan" as const,
				timestamp: now,
			}
		}),
	]
	const scores = new Map(
		Object.entries(SAMPLE_RATINGS).map(([id, score]) => [keyOf(id), score]),
	)
	return {
		...guest,
		viewer: { kind: "guest", progress: { interactions } },
		seen: new Set(scores.keys()),
		ratings: scores,
		wishlist: new Map(
			SAMPLE_WANT_TO_SEE.map((id) => [keyOf(id), new Date(now)]),
		),
		skipped: new Set(),
	}
}

// ---------- building a view ----------

function inputOf(
	kind: PortraitInput["kind"],
	ctx: ViewerContext,
	taste: Taste,
): PortraitInput {
	return {
		kind,
		scores: ctx.ratings,
		chosen: ctx.seen,
		wantToSee: new Set(ctx.wishlist.keys()),
		skipped: ctx.skipped,
		country: ctx.country,
		services: ctx.services,
		taste,
	}
}

const availabilityLoading = (input: PortraitInput) =>
	input.services.length > 0 &&
	isOnServices(input.country, input.services, 0) === null

async function buildView(
	snapshot: TitleSnapshot,
	input: PortraitInput,
	tab: PortraitTab,
): Promise<PortraitView> {
	const startedAt = performance.now()
	const person = readPerson(snapshot, input)
	const subject: PortraitSubject = {
		kind: input.kind,
		rated: person.rated.length,
		usual: person.rated.length ? round1(person.mu) : null,
	}
	const built =
		tab === "sides"
			? buildSides(person)
			: tab === "everyone"
				? buildEveryone(person)
				: buildFingerprint(person)
	const computedMs = performance.now() - startedAt

	// The titles the view names, with their display fields; a title Crate doesn't know is left out everywhere.
	const keys = viewKeys(built)
	const displays = await titleDisplays(keys)
	const unseen = [...keys].filter((key) => !input.scores.has(key))
	const matches = person.match(unseen)
	const unseenServices = new Map(
		(await getCardServices(input.country, unseen, input.services)).map(
			(services, i) => [unseen[i], services],
		),
	)
	const titles: Record<string, PortraitTitle> = {}
	for (const key of keys) {
		const display = displays.get(key)
		if (!display) continue
		const { mediaType, tmdbId } = parseTitleKey(key)
		const mine = input.scores.get(key) ?? null
		const seen = mine !== null || input.chosen.has(key)
		titles[key] = {
			key,
			mediaType,
			tmdbId,
			...display,
			score: snapshot.facts(key)?.score ?? null,
			mine,
			match: seen ? null : (matches.get(key) ?? null),
			onMyServices: seen ? null : person.onMyServices(key),
			reasons:
				seen || matches.get(key) == null
					? []
					: input.taste.reasons(key, CARD_REASONS),
			services: seen ? null : (unseenServices.get(key) ?? null),
		}
	}
	const services =
		built.tab === "sides" ? await getServiceList(input.services) : []
	const view = prune(
		(built.tab === "sides"
			? { ...built, subject, titles, services }
			: { ...built, subject, titles }) as PortraitView,
		(key) => titles[key] !== undefined,
	)
	console.info(
		`Taste portrait ${tab} for a ${input.kind}: ${person.rated.length} rated, ${keys.size} titles, computed in ${Math.round(computedMs)} ms, ${Math.round(performance.now() - startedAt)} ms in all`,
	)
	return view
}

/** A view before its subject and titles are added. */
type Built =
	| ReturnType<typeof buildSides>
	| ReturnType<typeof buildEveryone>
	| ReturnType<typeof buildFingerprint>

/** Every title key a view refers to. */
function viewKeys(view: Built): Set<TitleKey> {
	const keys = new Set<TitleKey>()
	const add = (list: (TitleKey | null)[]) => {
		for (const key of list) if (key !== null) keys.add(key)
	}
	if (view.tab === "sides")
		for (const side of view.sides) {
			add([...side.here, side.image, ...side.moreOfThis])
			for (const edge of side.edges)
				add([...edge.rated, ...edge.suggestions, edge.image])
		}
	else if (view.tab === "everyone")
		add([...view.higher, ...view.lower].map((row) => row.key))
	else {
		add(view.mostYou)
		for (const a of view.attributes)
			add([...a.carriers, ...a.against, a.exception])
	}
	return keys
}

/** Leaves out the keys of titles without display fields. */
function prune(
	view: PortraitView,
	has: (key: TitleKey) => boolean,
): PortraitView {
	const list = (keys: TitleKey[]) => keys.filter(has)
	const one = (key: TitleKey | null) => (key !== null && has(key) ? key : null)
	if (view.tab === "sides")
		return {
			...view,
			sides: view.sides.map((side) => ({
				...side,
				here: list(side.here),
				image: one(side.image),
				moreOfThis: list(side.moreOfThis),
				edges: side.edges.map((edge) => ({
					...edge,
					rated: list(edge.rated),
					suggestions: list(edge.suggestions),
					image: one(edge.image),
				})),
			})),
		}
	if (view.tab === "everyone")
		return {
			...view,
			higher: view.higher.filter((row) => has(row.key)),
			lower: view.lower.filter((row) => has(row.key)),
		}
	return {
		...view,
		mostYou: list(view.mostYou),
		attributes: view.attributes.map((a) => ({
			...a,
			carriers: list(a.carriers),
			against: list(a.against),
			exception: one(a.exception),
		})),
	}
}

function unavailable(tab: PortraitTab, kind: Viewer["kind"]): PortraitView {
	const base = {
		status: "unavailable" as const,
		subject: { kind, rated: 0, usual: null },
		titles: {},
	}
	if (tab === "sides")
		return {
			...base,
			tab,
			sides: [],
			headline: null,
			openFirst: null,
			hasServices: false,
			services: [],
		}
	if (tab === "everyone")
		return {
			...base,
			tab,
			headline: "",
			agreement: 0,
			offset: 0,
			counted: 0,
			higher: [],
			lower: [],
			attributes: [],
			genres: [],
		}
	return {
		...base,
		tab,
		identity: null,
		line: "",
		seek: [],
		avoid: [],
		families: FAMILIES,
		attributes: [],
		mostYou: [],
	}
}
