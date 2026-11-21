// PROTOTYPE - throwaway (prototype/explore-r5). The lab panel (prototype-only, hidden in production). It replaces
// the concept switcher on lab pages: for every slot that applies to the page in view, its variants as pills. A pick is
// stored in the cookie `gw-lab` and the page re-renders in place. Also: page links, Movies | Shows | Both, the notes,
// and the round 4 concepts for comparison. `[` and `]` step through the variants of the page's main slot. It collapses
// to a small tab in the corner and remembers that. Fuchsia on white on purpose: it must not read as part of the design.
//
// On a phone each strip scrolls sideways on a line of its own; from tablet width up it wraps, so every option shows without scrolling.
// It stays small: the page's main slot is a row of pills; every other slot that applies is one small "Label: pick"
// pill that opens a menu of its variants. "Recommended" and "All round 4" set every slot at once. "Copy picks" puts
// every slot's pick on the clipboard as text, to paste into a message.
import { Link } from "@remix-run/react"
import { useEffect, useState } from "react"
import {
	type Address,
	KINDS,
	type Kind,
	best,
	familyPage,
	href,
	hub,
	ing,
	place,
	realPath,
	withKind,
} from "../../kit/address"
import type { ConceptModule, Note, QuickLink } from "../../kit/contract"
import type { ExploreData } from "../../shell/load.server"
import type { LabData } from "./contract"
import { useResetPicks, useSetPick } from "./lab"
import { formatPicks } from "./picks"
import { allSlots, baselineOf, slotsFor, variantsOf } from "./registry"

export const labQuickLinks = (kind: Kind): QuickLink[] => [
	{ label: "Hub", address: hub(kind) },
	{ label: "Moods", address: familyPage(kind, "mood") },
	{ label: "Mood", address: place(kind, [ing("mood", "cozy")]) },
	{ label: "Genres", address: familyPage(kind, "genre") },
	{ label: "Genre", address: place(kind, [ing("genre", "comedy")]) },
	{ label: "Eras", address: familyPage(kind, "decade") },
	{ label: "Era", address: place(kind, [ing("decade", "1990s")]) },
	{ label: "Places", address: familyPage(kind, "country") },
	{ label: "Country", address: place(kind, [ing("country", "japan")]) },
	{ label: "Streaming", address: familyPage(kind, "service") },
	{ label: "Service", address: place(kind, [ing("service", "netflix")]) },
	{ label: "Best", address: best(kind) },
	{ label: "Best, filtered", address: best(kind, [ing("mood", "cozy")], 2025) },
	{ label: "Blend of 2", address: place(kind, [ing("mood", "cozy"), ing("genre", "comedy")]) },
	{
		label: "Blend of 3",
		address: place(kind, [ing("mood", "dark"), ing("genre", "thriller"), ing("decade", "2010s")]),
	},
	// Round 6: themes have no index of their own any more (they repeat genres and moods); traits became tropes.
	{ label: "Tropes", address: familyPage(kind, "trope") },
	{ label: "Trope", address: place(kind, [ing("trope", "chekhovs-gun")]) },
]

const ROUND_4 = [
	{ id: "rooms", name: "Rooms" },
	{ id: "dials", name: "Dials" },
	{ id: "blend", name: "Blend" },
	{ id: "guide", name: "Guide" },
]
const KIND_SHORT: Record<Kind, string> = { movie: "Movies", show: "Shows", all: "Both" }
const STORE = "gw-explore-lab-panel"
// A page's own key widgets keep their keys.
const OWN_KEYS =
	"input, textarea, select, [contenteditable], [role=slider], [role=radiogroup], [role=tablist], [role=menu], [role=listbox], [role=dialog], [data-row], [data-rail], [data-keys]"

/** The clipboard, also where the async API is missing (plain http): a hidden field and the old copy command. */
async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text)
		return true
	} catch {}
	try {
		const field = document.createElement("textarea")
		field.value = text
		field.setAttribute("readonly", "")
		field.style.cssText = "position:fixed;top:0;left:0;opacity:0"
		document.body.appendChild(field)
		field.select()
		const done = document.execCommand("copy")
		field.remove()
		return done
	} catch {
		return false
	}
}

/** The panel and its popovers rise in (round 6 motion: 200 ms on the site's ease-out). */
const KEYFRAMES = (
	<style>
		{
			"@keyframes gwLabIn{from{opacity:0;transform:translateY(6px) scale(.985)}to{opacity:1;transform:none}}"
		}
	</style>
)

const pill =
	"shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.96] motion-reduce:transition-none"
const quiet = "bg-neutral-100 text-black hover:bg-neutral-200"

export function LabPanel({
	d,
	notes,
}: {
	d: ExploreData
	concept: ConceptModule | null
	notes: Note[]
}) {
	const lab = d.data as LabData
	const setPick = useSetPick()
	const [open, setOpen] = useState(true)
	const resetPicks = useResetPicks()
	// What is open above the panel: the notes, the round 4 links, or one part slot's menu ("part:<slot id>").
	const [show, setShow] = useState<string | null>(null)
	const [copied, setCopied] = useState<boolean | null>(null)
	useEffect(() => {
		try {
			if (localStorage.getItem(STORE) === "closed") setOpen(false)
		} catch {}
	}, [])
	const toggle = () =>
		setOpen((o) => {
			try {
				localStorage.setItem(STORE, o ? "closed" : "open")
			} catch {}
			return !o
		})
	// A sub-slot of a page (the mood page's head, dials, kinds) does nothing under that page's round 4 variant.
	const idle = (id: string) => id.startsWith("mood-") && lab.variant.startsWith("r4")
	const slots = slotsFor(d.address).filter((s) => !idle(s.id))
	const main = slots.find((s) => s.id === lab.slot)
	const parts = slots.filter((s) => s.id !== lab.slot)
	const pageVariants = variantsOf(lab.slot)
	// Every slot at once: the recommended combination (each slot's fallback) or the round 4 baselines.
	const every = allSlots()
	const recommended = every.every((s) => lab.picks[s.id] === s.fallback)
	const allRound4 = every.every((s) => lab.picks[s.id] === baselineOf(s.id))
	const step = (by: number) => {
		if (pageVariants.length < 2) return
		const at = pageVariants.findIndex((v) => v.id === lab.variant)
		const next = pageVariants[(Math.max(0, at) + by + pageVariants.length) % pageVariants.length]
		setPick(lab.slot, next.id)
	}
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
			// The page's own widgets keep their keys; the panel's own pills don't count as one.
			const busy = (el: HTMLElement | null) =>
				Boolean(el?.closest?.(OWN_KEYS)) && !el?.closest("[data-lab-panel]")
			if (busy(e.target as HTMLElement) || busy(document.activeElement as HTMLElement | null))
				return
			if (e.key === "[") step(-1)
			if (e.key === "]") step(1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	if (process.env.NODE_ENV === "production") return null

	const kind = d.address.kind
	const here = (a: Address) => realPath(a) === realPath(d.address)
	const pageName = pageVariants.find((v) => v.id === lab.variant)?.name ?? lab.variant
	const toldVariant = main && pageVariants.find((v) => v.id === lab.variant)
	const nameOf = (slot: string) =>
		variantsOf(slot).find((v) => v.id === lab.picks[slot])?.name ?? lab.picks[slot]
	// Every slot's pick as text: one readable line per slot, then the same as one `?lab=` value.
	const picksText = [
		"GoodWatch Explore lab picks",
		...every.map((s) => {
			const id = lab.picks[s.id]
			const name = variantsOf(s.id).find((v) => v.id === id)?.name ?? id
			return `${s.label}: ${name} [${s.id}:${id}]${id === s.fallback ? "" : ` (recommended was ${s.fallback})`}`
		}),
		`lab=${formatPicks(lab.picks)}`,
	].join("\n")
	const copyPicks = async () => {
		setCopied(await copyText(picksText))
		setShow("copy")
	}
	const menu = show?.startsWith("part:") ? parts.find((s) => `part:${s.id}` === show) : undefined

	if (!open)
		return (
			<>
				{KEYFRAMES}
				<button
					type="button"
					onClick={toggle}
					data-proto-switcher=""
					aria-label="Open the lab panel"
					className="motion-safe:animate-[gwLabIn_200ms_cubic-bezier(0.22,1,0.36,1)_both] fixed right-3 bottom-[5.75rem] z-[60] flex h-9 max-w-[70vw] items-center gap-1.5 rounded-full bg-white px-3 text-xs font-bold text-black shadow-xl ring-2 ring-fuchsia-500 lg:bottom-4"
				>
					<span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-fuchsia-500" />
					<span className="truncate">Lab · {pageName}</span>
				</button>
			</>
		)

	return (
		<div
			data-proto-switcher=""
			data-lab-panel=""
			className="fixed bottom-[5.75rem] left-1/2 z-[60] w-[min(100vw-1rem,1100px)] -translate-x-1/2 text-black lg:bottom-4"
		>
			{KEYFRAMES}
			{show === "notes" && (
				<div className="motion-safe:animate-[gwLabIn_200ms_cubic-bezier(0.22,1,0.36,1)_both] mb-2 max-h-[50vh] overflow-y-auto rounded-2xl bg-white p-4 text-sm shadow-2xl ring-2 ring-fuchsia-500">
					<p className="text-xs font-bold tracking-wide text-fuchsia-600 uppercase">
						Lab notes · what is picked on this page
					</p>
					<dl className="mt-2 space-y-1.5">
						{slots.map((s) => {
							const v = variantsOf(s.id).find((x) => x.id === lab.picks[s.id])
							return (
								<div key={s.id}>
									<dt className="inline font-bold">
										{s.label} · {v?.name ?? lab.picks[s.id]}:{" "}
									</dt>
									<dd className="inline text-neutral-700">{v?.what}</dd>
								</div>
							)
						})}
					</dl>
					{notes.length > 0 && (
						<dl className="mt-3 space-y-2 border-t border-neutral-200 pt-3">
							{notes.map((n) => (
								<div key={n.term}>
									<dt className="inline font-bold">
										{n.term}
										{n.isNew && (
											<span className="ml-1.5 rounded bg-fuchsia-100 px-1 py-0.5 text-[10px] font-bold text-fuchsia-700 uppercase">
												new
											</span>
										)}
										{": "}
									</dt>
									<dd className="inline text-neutral-700">{n.means}</dd>
								</div>
							))}
						</dl>
					)}
					<p className="mt-3 border-t border-neutral-200 pt-3 text-xs text-neutral-600">
						Real address <code className="font-mono text-neutral-900">{d.canonical}</code>
						{d.address.view === "place" &&
							` · ${d.titles.toLocaleString("en-US")} well-known titles · ${d.indexable ? "indexable" : "noindex (too few titles)"}`}
						{` · server ${d.ms} ms · picks live in the cookie gw-lab; ?lab=slot:variant overrides for one request`}
					</p>
				</div>
			)}
			{show === "copy" && (
				<div className="motion-safe:animate-[gwLabIn_200ms_cubic-bezier(0.22,1,0.36,1)_both] mb-2 ml-auto w-full rounded-2xl bg-white p-3 text-sm shadow-2xl ring-2 ring-fuchsia-500 sm:w-[30rem]">
					<output className="block text-xs font-bold tracking-wide text-fuchsia-600 uppercase">
						{copied
							? "Copied · your picks for every page"
							: "Couldn't reach the clipboard · select and copy this"}
					</output>
					<textarea
						readOnly
						data-lab-copy-text=""
						aria-label="Your picks as text"
						value={picksText}
						rows={Math.min(14, every.length + 2)}
						onFocus={(e) => e.currentTarget.select()}
						className="mt-2 w-full resize-none rounded-lg bg-neutral-100 p-2 font-mono text-[11px] leading-snug text-neutral-900"
					/>
					<p className="mt-1 text-xs text-neutral-600">
						Paste this into your message. A pick applies to every page of its kind, so one copy
						covers the whole lab.
					</p>
				</div>
			)}
			{show === "round4" && (
				<div className="motion-safe:animate-[gwLabIn_200ms_cubic-bezier(0.22,1,0.36,1)_both] mb-2 ml-auto w-fit rounded-2xl bg-white p-3 text-sm shadow-2xl ring-2 ring-fuchsia-500">
					<p className="text-xs font-bold tracking-wide text-fuchsia-600 uppercase">
						This page in a round 4 concept
					</p>
					<div className="mt-2 flex gap-1">
						{ROUND_4.map((c) => (
							<Link key={c.id} to={href(c.id, d.address)} className={`${pill} ${quiet}`}>
								{c.name}
							</Link>
						))}
					</div>
				</div>
			)}
			{menu && (
				<div
					role="radiogroup"
					aria-label={`${menu.label} variant`}
					data-lab-slot={menu.id}
					className="motion-safe:animate-[gwLabIn_200ms_cubic-bezier(0.22,1,0.36,1)_both] mb-2 max-h-[50vh] w-full overflow-y-auto rounded-2xl bg-white p-1.5 text-sm shadow-2xl ring-2 ring-fuchsia-500 sm:w-[26rem]"
				>
					<p className="px-2 pt-1 pb-1.5 text-xs font-bold tracking-wide text-fuchsia-600 uppercase">
						{menu.label}
					</p>
					{variantsOf(menu.id).map((v) => {
						const on = lab.picks[menu.id] === v.id
						return (
							<button
								key={v.id}
								type="button"
								// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the ARIA radio pattern on styled buttons
								role="radio"
								aria-checked={on}
								aria-label={`${v.name}: ${v.what}`}
								data-lab-variant={v.id}
								onClick={() => {
									if (!on) setPick(menu.id, v.id)
								}}
								className={`flex w-full items-baseline gap-2 rounded-xl px-2 py-1.5 text-left transition-colors duration-[160ms] ${on ? "bg-fuchsia-50" : "hover:bg-neutral-100"}`}
							>
								<span
									aria-hidden
									className={`relative top-0.5 h-3 w-3 shrink-0 rounded-full ring-2 ${on ? "bg-fuchsia-600 ring-fuchsia-600" : "ring-neutral-300"}`}
								/>
								<span className="min-w-0">
									<span className={`font-bold ${on ? "text-fuchsia-700" : "text-neutral-900"}`}>
										{v.name}
									</span>
									<span className="block text-xs leading-snug text-neutral-600">{v.what}</span>
								</span>
							</button>
						)
					})}
				</div>
			)}
			<div className="motion-safe:animate-[gwLabIn_200ms_cubic-bezier(0.22,1,0.36,1)_both] max-h-[46vh] overflow-y-auto rounded-2xl bg-white p-1.5 shadow-2xl ring-2 ring-fuchsia-500">
				{/* Where: page links, the kind, and the panel's own buttons. */}
				<div className="flex items-center gap-1 max-sm:flex-wrap sm:items-start">
					<span className="shrink-0 rounded-full bg-fuchsia-600 px-2 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
						Lab
					</span>
					<div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] sm:flex-wrap sm:overflow-visible max-sm:order-last max-sm:basis-full">
						{labQuickLinks(kind).map((l) => (
							<Link
								key={l.label}
								to={href(d.concept, l.address)}
								className={`${pill} ${here(l.address) ? "bg-fuchsia-100 text-fuchsia-800" : quiet}`}
							>
								{l.label}
							</Link>
						))}
					</div>
					<div className="flex shrink-0 items-center rounded-full bg-neutral-900 p-0.5 max-sm:hidden">
						{KINDS.map((k) => (
							<Link
								key={k}
								to={href(d.concept, withKind(d.address, k))}
								title={`This page for ${KIND_SHORT[k].toLowerCase()}`}
								className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${k === kind ? "bg-white text-black" : "text-neutral-300 hover:text-white"}`}
							>
								{KIND_SHORT[k]}
							</Link>
						))}
					</div>
					<button
						type="button"
						onClick={() => setShow((s) => (s === "notes" ? null : "notes"))}
						aria-pressed={show === "notes"}
						className={`${pill} max-sm:ml-auto ${show === "notes" ? "bg-neutral-900 text-white" : quiet}`}
					>
						Notes
					</button>
					<button
						type="button"
						onClick={() => setShow((s) => (s === "round4" ? null : "round4"))}
						aria-pressed={show === "round4"}
						className={`${pill} ${show === "round4" ? "bg-neutral-900 text-white" : quiet}`}
					>
						Round 4
					</button>
					<button
						type="button"
						onClick={toggle}
						aria-label="Collapse the lab panel"
						className="shrink-0 rounded-full px-2 py-1 text-sm font-bold text-neutral-500 hover:bg-neutral-200"
					>
						×
					</button>
				</div>
				{/* What: the page's main slot as a row of pills. */}
				{main && (
					<div className="mt-1 flex items-center gap-1.5 border-t border-neutral-200 pt-1 sm:items-start">
						<span
							className="w-[4.5rem] shrink-0 truncate pl-1.5 text-[11px] font-bold tracking-wide text-fuchsia-700 uppercase sm:w-20"
							title={`slot "${main.id}"`}
						>
							{main.label}
						</span>
						<div
							role="radiogroup"
							aria-label={`${main.label} variant`}
							data-lab-slot={main.id}
							className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] sm:flex-wrap sm:overflow-visible"
						>
							{pageVariants.map((v) => {
								const on = lab.variant === v.id
								return (
									<button
										key={v.id}
										type="button"
										// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the ARIA radio pattern on styled buttons
										role="radio"
										aria-checked={on}
										data-lab-variant={v.id}
										title={v.what}
										onClick={() => {
											if (!on) setPick(main.id, v.id)
										}}
										className={`${pill} ${on ? "bg-fuchsia-600 text-white" : quiet}`}
									>
										{v.name}
									</button>
								)
							})}
						</div>
						{pageVariants.length > 1 && (
							<span className="shrink-0 pr-1 font-mono text-[11px] text-neutral-400 max-sm:hidden">
								[ ]
							</span>
						)}
					</div>
				)}
				{/* The other slots: one small pill each, which opens its menu. Then every slot at once. */}
				<div className="mt-1 flex items-center gap-1 border-t border-neutral-200 pt-1 max-sm:flex-wrap sm:items-start">
					<div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] sm:flex-wrap sm:overflow-visible max-sm:order-last max-sm:basis-full">
						{parts.map((s) => {
							const open = show === `part:${s.id}`
							const off = lab.picks[s.id] !== s.fallback
							return (
								<button
									key={s.id}
									type="button"
									aria-expanded={open}
									data-lab-part={s.id}
									title={`slot "${s.id}"`}
									onClick={() => setShow(open ? null : `part:${s.id}`)}
									className={`flex shrink-0 items-center gap-1 rounded-full py-0.5 pr-1.5 pl-2 text-[11px] whitespace-nowrap ring-1 transition-[background-color,color,box-shadow,transform] duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.96] motion-reduce:transition-none ${open ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-600 ring-neutral-300 hover:bg-neutral-100"}`}
								>
									{s.label}:
									<span
										className={`font-bold ${open ? "text-white" : off ? "text-fuchsia-700" : "text-neutral-900"}`}
									>
										{nameOf(s.id)}
									</span>
									<span aria-hidden className="text-[9px] opacity-60">
										{open ? "▴" : "▾"}
									</span>
								</button>
							)
						})}
					</div>
					<button
						type="button"
						data-lab-all="recommended"
						aria-pressed={recommended}
						title="Every slot back to the recommended variant (clears your picks)"
						onClick={() => resetPicks({})}
						className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${recommended ? "bg-fuchsia-600 text-white" : "bg-fuchsia-100 text-fuchsia-800 hover:bg-fuchsia-200"}`}
					>
						Recommended
					</button>
					<button
						type="button"
						data-lab-all="round4"
						aria-pressed={allRound4}
						title="Every slot to its round 4 baseline, to compare"
						onClick={() =>
							resetPicks(Object.fromEntries(every.map((s) => [s.id, baselineOf(s.id)])))
						}
						className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${allRound4 ? "bg-neutral-900 text-white" : quiet}`}
					>
						All round 4
					</button>
					<button
						type="button"
						data-lab-copy=""
						aria-expanded={show === "copy"}
						title="Copy every slot's pick as text, to paste into a message"
						onClick={() => (show === "copy" ? setShow(null) : copyPicks())}
						className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${show === "copy" ? "bg-neutral-900 text-white" : quiet}`}
					>
						{show === "copy" && copied ? "Copied" : "Copy picks"}
					</button>
				</div>
				{toldVariant && (
					<p className="mt-1 border-t border-neutral-200 px-1.5 pt-1 pb-0.5 text-xs leading-snug text-neutral-600">
						<span className="font-bold text-neutral-900">
							{main.label} · {toldVariant.name}:
						</span>{" "}
						{toldVariant.what}
					</p>
				)}
			</div>
		</div>
	)
}
