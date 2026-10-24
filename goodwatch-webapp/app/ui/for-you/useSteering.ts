// The steering state: the picked recipe and the five handle levels. The ranking follows at once, in memory.
// - Recipes: the member's own taste groups first, then the library; a recipe shows only when at least MIN_FIT titles
//   fit it. Each tile's three posters are its own top picks, worked out once per pool, so tiles never move while you
//   steer.
// - Reverse matching: a handle landing near a visible recipe's shape picks it; the picked recipe holds while the shape
//   stays within TOLERANCE of it and lets go beyond (said quietly in the bar for a moment).
// - The dice: a recipe (or none, one in five) plus one or two handle tweaks, never a recent state, only landing on a
//   recipe you can see.
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	type DecodedPool,
	FAMILY_ORDER,
	FP_KEYS,
	type FamilyId,
	type ForYouTaste,
} from "~/domain/for-you-page/contract"
import { DESK_SIZE, DRAWER_SIZE, drawerOrder } from "~/domain/for-you-page/rail"
import {
	type PoolStats,
	type Ranked,
	rankPool,
} from "~/domain/for-you-page/rank"
import { LIBRARY, MIN_FIT, ownRecipes } from "~/domain/for-you-page/recipes"
import {
	type Bundle,
	FAMILY_WORD,
	FLAT,
	type Level,
	type Levels,
	type Recipe,
	TOLERANCE,
	drift,
	familyPushes,
	isFlat,
	levelsKey,
	steerOf,
	steps,
	summaryOf,
} from "~/domain/for-you-page/shape"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"

const N = FP_KEYS.length
/** A title fits a recipe when its weighted z-score average over the recipe is at least this. */
const FIT = 0.7
/** A recipe is picked by itself when the handles come within this drift of its shape. */
const AUTO = 1

/** Where the steering happens right now: the recipe tiles a drag or the dice may land on depend on it. */
export type Surface = "desk" | "drawer" | "bar"

const pickOne = <T>(xs: readonly T[]) =>
	xs[Math.floor(Math.random() * xs.length)]
const shuffle = <T>(xs: readonly T[]) =>
	[...xs]
		.map((x) => [Math.random(), x] as const)
		.sort((a, b) => a[0] - b[0])
		.map(([, x]) => x)
const clampLevel = (n: number) => Math.max(-1, Math.min(2, n)) as Level

/** Scrolls a tile of the open recipe drawer into view. */
const showTile = (id: string) =>
	document
		.querySelector(`[data-recipe-tiles] [data-recipe="${CSS.escape(id)}"]`)
		?.scrollIntoView({ block: "nearest", behavior: "smooth" })

/** Just the handle part of the line, lower case: "more Story, less Feel". */
function tweakOf(recipe: Recipe | undefined, levels: Levels): string | null {
	const s = summaryOf(recipe, levels)
	if (!s) return null
	if (!recipe) return s.replace(/ than usual$/, "").toLowerCase()
	const at = s.indexOf(", with ")
	return at < 0 ? null : s.slice(at + 7)
}

export function useSteering({
	pool,
	stats,
	taste,
	initialRecipe,
	surface,
}: {
	pool: DecodedPool
	stats: PoolStats
	taste: ForYouTaste
	/** A recipe id to start with (?recipe=). */
	initialRecipe: string | null
	/** Read on each drag release and dice roll. */
	surface: () => Surface
}) {
	const byKey = useMemo(
		() => new Map(taste.attributes.map((a) => [a.key, a])),
		[taste.attributes],
	)
	const attr = useCallback((k: string) => byKey.get(k), [byKey])
	const library = useMemo(
		() => [...ownRecipes(taste.groups), ...LIBRARY],
		[taste.groups],
	)
	const byId = useMemo(() => new Map(library.map((m) => [m.id, m])), [library])
	const pushes = useMemo(() => familyPushes(taste), [taste])
	const n = pool.keys.length

	// ---------- per recipe: how well each title fits, how many fit, how much your taste likes it ----------
	const fitScore = useMemo(() => {
		const scoreOf = (b: Bundle) => {
			const ks = Object.entries(b).map(
				([k, w]) =>
					[FP_KEYS.indexOf(k as (typeof FP_KEYS)[number]), w] as const,
			)
			const tot = ks.reduce((s, [, w]) => s + Math.abs(w), 0) || 1
			const out = new Float32Array(n)
			for (let i = 0; i < n; i++) {
				let s = 0
				for (const [k, w] of ks) if (k >= 0) s += w * stats.z[i * N + k]
				out[i] = s / tot
			}
			return out
		}
		return Object.fromEntries(library.map((m) => [m.id, scoreOf(m.attrs)]))
	}, [library, n, stats])
	const count = useMemo(() => {
		const out: Record<string, number> = {}
		for (const m of library) {
			let c = 0
			for (const s of fitScore[m.id]) if (s >= FIT) c++
			out[m.id] = c
		}
		return out
	}, [library, fitScore])
	const like = useMemo(() => {
		const out: Record<string, number> = {}
		for (const m of library) {
			let s = 0
			let tot = 0
			for (const [k, w] of Object.entries(m.attrs)) {
				s += w * (attr(k)?.edge ?? 0)
				tot += Math.abs(w)
			}
			out[m.id] = tot ? s / tot : 0
		}
		return out
	}, [library, attr])
	const available = useMemo(
		() => library.filter((m) => (count[m.id] ?? 0) >= MIN_FIT),
		[library, count],
	)
	const info = useMemo(() => ({ count, like }), [count, like])
	const orderFor = useCallback(
		(m: string | null, lv: Levels, size: number) =>
			drawerOrder(available, lv, m ? byId.get(m) : undefined, info, size),
		[available, byId, info],
	)

	// ---------- the state ----------
	const start = initialRecipe ? byId.get(initialRecipe) : undefined
	const [recipe, setRecipe] = useState<string | null>(start?.id ?? null)
	const [levels, setLevels] = useState<Levels>(
		start ? { ...start.shape } : FLAT,
	)
	const live = useRef({ recipe, levels })
	const tile = recipe ? byId.get(recipe) : undefined
	const steer = useMemo(
		() => steerOf(tile, levels, pushes),
		[tile, levels, pushes],
	)
	const ranked = useMemo(
		() => rankPool(pool, stats, taste, steer),
		[pool, stats, taste, steer],
	)

	// Each tile's posters: the recipe's top picks on its own shape, once per pool.
	const previews = useMemo(() => {
		const out: Record<string, Ranked[]> = {}
		for (const m of library)
			out[m.id] = rankPool(pool, stats, taste, steerOf(m, m.shape, pushes), {
				reasonsTop: 0,
			}).slice(0, 3)
		return out
	}, [library, pool, stats, taste, pushes])

	// The drawer re-sorts only on the way in; the desktop tiles keep one order.
	const [drawerIds, setDrawerIds] = useState(() =>
		orderFor(start?.id ?? null, start?.shape ?? FLAT, DRAWER_SIZE),
	)
	const [deskIds, setDeskIds] = useState(() =>
		orderFor(start?.id ?? null, FLAT, DESK_SIZE),
	)
	const firstOrder = useRef(true)
	useEffect(() => {
		if (firstOrder.current) {
			firstOrder.current = false
			return
		}
		const s = live.current
		setDrawerIds(orderFor(s.recipe, s.levels, DRAWER_SIZE))
		setDeskIds(orderFor(s.recipe, FLAT, DESK_SIZE))
	}, [orderFor])
	const sortDrawer = useCallback(() => {
		const s = live.current
		setDrawerIds(orderFor(s.recipe, s.levels, DRAWER_SIZE))
	}, [orderFor])

	// The recipe a handle drag just let go of, said quietly in the bar for a moment.
	const [letGo, setLetGo] = useState<string | null>(null)
	const letGoTimer = useRef(0)
	useEffect(() => () => window.clearTimeout(letGoTimer.current), [])

	const commit = useCallback((m: string | null, lv: Levels) => {
		const s = live.current
		if (s.recipe === m && levelsKey(s.levels) === levelsKey(lv)) return
		if (m) {
			window.clearTimeout(letGoTimer.current)
			setLetGo(null)
		}
		live.current = { recipe: m, levels: lv }
		setRecipe(m)
		setLevels(lv)
	}, [])

	/** A tile tap in the drawer: pick it, or let it go and keep your own changes on top of it. */
	const pick = (id: string) => {
		const m = byId.get(id)
		if (!m) return
		const s = live.current
		if (s.recipe === id) {
			const lv = { ...FLAT }
			for (const f of FAMILY_ORDER) lv[f] = clampLevel(s.levels[f] - m.shape[f])
			return commit(null, lv)
		}
		commit(id, { ...m.shape })
	}
	/** A tile click on desktop: pick it, or back to your taste. */
	const pickOnDesk = (id: string) => {
		if (live.current.recipe === id) return commit(null, FLAT)
		const m = byId.get(id)
		if (m) commit(id, { ...m.shape })
	}

	/** The recipes a handle drag may land on: only tiles you can see. */
	const matchable = useCallback((): Recipe[] => {
		const where = surface()
		const ids =
			where === "desk"
				? window.matchMedia("(min-width: 1280px)").matches
					? deskIds
					: deskIds.slice(0, 8)
				: where === "drawer"
					? drawerIds
					: null
		if (!ids) return available
		return ids.map((id) => byId.get(id)).filter((m): m is Recipe => !!m)
	}, [surface, deskIds, drawerIds, byId, available])

	/** A handle landing at `l`. The handles stay where you put them: a recipe only adds its own push on top. */
	const onSet = useCallback(
		(f: FamilyId, l: Level) => {
			const s = live.current
			const lv = { ...s.levels, [f]: l }
			const m = s.recipe ? byId.get(s.recipe) : undefined
			if (m && drift(lv, m.shape) <= TOLERANCE) return commit(s.recipe, lv)
			let best: Recipe | undefined
			let bd = Number.POSITIVE_INFINITY
			if (!isFlat(lv))
				for (const x of matchable()) {
					const d = drift(lv, x.shape)
					if (d > AUTO) continue
					if (d < bd || (d === bd && x.yours && !best?.yours)) {
						best = x
						bd = d
					}
				}
			if (best) {
				commit(best.id, lv)
				if (surface() === "drawer") showTile(best.id)
				return
			}
			commit(null, lv)
			if (m) {
				setLetGo(m.name)
				window.clearTimeout(letGoTimer.current)
				letGoTimer.current = window.setTimeout(() => setLetGo(null), 2600)
			}
		},
		[byId, commit, matchable, surface],
	)

	const [rolls, setRolls] = useState(0)
	const recent = useRef<string[]>([])
	const roll = () => {
		const where = surface()
		const within =
			where === "desk"
				? new Set(deskIds)
				: where === "drawer"
					? new Set(drawerIds)
					: null
		const s = live.current
		const now = `${s.recipe ?? "-"}|${levelsKey(s.levels)}`
		for (let i = 0; i < 80; i++) {
			const choices = available.filter(
				(m) => m.id !== s.recipe && (!within || within.has(m.id)),
			)
			const m =
				Math.random() < 0.8 && choices.length ? pickOne(choices) : undefined
			const base = m?.shape ?? FLAT
			const lv: Levels = { ...base }
			for (const f of shuffle(FAMILY_ORDER).slice(
				0,
				Math.random() < 0.5 ? 1 : 2,
			))
				lv[f] = clampLevel(lv[f] + pickOne(m ? [-1, 1] : [1, 1, 2, -1]))
			if (m && (steps(lv, base) === 0 || drift(lv, base) > TOLERANCE)) continue
			if (
				!m &&
				(isFlat(lv) || FAMILY_ORDER.filter((f) => lv[f] < 0).length > 1)
			)
				continue
			const key = `${m?.id ?? "-"}|${levelsKey(lv)}`
			if (key === now || recent.current.includes(key)) continue
			recent.current = [key, ...recent.current].slice(0, 12)
			setRolls((r) => r + 1)
			commit(m?.id ?? null, lv)
			if (where === "drawer" && m) showTile(m.id)
			return
		}
	}
	const reset = () => commit(null, FLAT)
	const touched = !!recipe || !isFlat(levels)

	// ---------- words ----------
	const tweak = tweakOf(tile, levels)
	const shape = tile?.shape ?? FLAT
	/** The detail's why line when no loved title carries the pick: the steer it answers, in a few words. */
	const answer = useCallback(
		(r: Ranked): string | null => {
			const raised = FAMILY_ORDER.filter((f) => levels[f] > shape[f])
			const lowered = FAMILY_ORDER.filter((f) => levels[f] < shape[f])
			const hit = r.reasons.find((x) => raised.includes(x.family))
			if (hit) {
				const label = attr(hit.key)?.label ?? getFingerprintMeta(hit.key).label
				return `More ${FAMILY_WORD[hit.family]}: ${label.toLowerCase()}`
			}
			if (tile && fitScore[tile.id][r.index] >= 0.2)
				return `A strong fit for ${tile.name.toLowerCase()}`
			if (lowered.length) return `Easy on ${FAMILY_WORD[lowered[0]]}`
			return "Close to your taste"
		},
		[levels, shape, tile, fitScore, attr],
	)

	return {
		attr,
		byId,
		recipe,
		tile,
		levels,
		ranked,
		previews,
		drawerIds,
		deskIds,
		sortDrawer,
		pick,
		pickOnDesk,
		onSet,
		roll,
		rolls,
		reset,
		touched,
		letGo,
		tweak,
		answer,
	}
}
