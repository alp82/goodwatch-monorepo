// PROTOTYPE - throwaway (#662). The quiet ways to say "something new may be forming in your taste mix": the line on
// the title page after a rating, the dot on the Taste tile in Browse, and the note on Your taste mix. Members read
// "taste" and "mix", never "side" or "group" (CONTEXT.md, Taste group).
import { Link } from "@remix-run/react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import type { Forming, FormingTitle } from "~/server/prototype-forming-hint/index.server"
import { TmdbImage } from "~/ui/TmdbImage"
import { titleToDashed } from "~/utils/helpers"
import { markSeen, useFired, useHint, useProto } from "./state"

export const COPY = {
	headline: "Something new may be forming in your taste mix",
	short: "Something new may be forming in your taste",
	with: (titles: FormingTitle[]) => `With ${names(titles.slice(1, 3))}`,
	needs: "A few more like them, and they may join it.",
	noteLabel: "May be forming",
	note: (titles: FormingTitle[]) => `You love ${names(titles)}, and they go together, but they aren't in your mix yet.`,
}

const names = (titles: FormingTitle[]) =>
	titles.length <= 1 ? (titles[0]?.title ?? "") : `${titles.slice(0, -1).map((t) => t.title).join(", ")} and ${titles[titles.length - 1].title}`

const href = (t: FormingTitle) => `/${t.mediaType}/${t.tmdbId}-${titleToDashed(t.title)}`

function Stack({ titles, size = "sm" }: { titles: FormingTitle[]; size?: "xs" | "sm" }) {
	return (
		<div className="flex shrink-0 -space-x-3 rounded-lg border-2 border-dashed border-violet-300/50 p-1">
			{titles.slice(0, 3).map((t) => (
				<span key={t.key} className={`relative block shrink-0 overflow-hidden rounded-md bg-gray-900 ring-2 ring-stone-950 ${size === "xs" ? "w-6" : "w-9 md:w-10"}`}>
					<TmdbImage kind="poster" path={t.poster} width={40} alt="" className="block aspect-[2/3] w-full object-cover" draggable={false} />
				</span>
			))}
		</div>
	)
}

/**
 * Variant "line": after a rating that may start something new, one quiet row where the title page's taste line goes
 * (the line itself leaves once the title is rated). Smaller and dimmer than the taste line, no button, and it fades
 * out after 8 seconds; a tap opens Your taste mix.
 */
export function FormingLine({ forming }: { forming: Forming }) {
	const [slot, setSlot] = useState<Element | null>(null)
	const [phase, setPhase] = useState<"in" | "shown" | "out" | "gone">("in")
	useEffect(() => {
		setSlot(document.querySelector('[data-proto-forming="line"]'))
		const shown = setTimeout(() => setPhase("shown"), 30)
		const out = setTimeout(() => setPhase("out"), 8000)
		const gone = setTimeout(() => setPhase("gone"), 8700)
		return () => [shown, out, gone].forEach(clearTimeout)
	}, [])
	if (!slot || phase === "gone") return null
	return createPortal(
		<Link
			to="/taste"
			aria-live="polite"
			className={`mx-3 mt-3 flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-opacity duration-700 hover:bg-white/[0.04] md:mx-5 md:mt-4 ${phase === "shown" ? "opacity-100" : "opacity-0"}`}
		>
			<Stack titles={forming.titles} size="xs" />
			<span className="min-w-0 flex-1 text-sm leading-snug">
				<span className="block text-gray-200">
					<span className="max-sm:hidden">{COPY.headline}</span>
					<span className="sm:hidden">{COPY.short}</span>
				</span>
				<span className="block truncate text-gray-400">{COPY.with(forming.titles)}</span>
			</span>
		</Link>,
		slot,
	)
}

/** Variant "dot": a small dot on the Taste tile in Browse while something new may be forming and Taste hasn't shown it. */
export function FormingDot() {
	const proto = useProto()
	const { fired, seen } = useFired()
	if (proto?.variant !== "dot" || !fired || seen) return null
	return (
		<span className="absolute top-3.5 right-3.5 z-10 h-2.5 w-2.5 rounded-full bg-violet-300 ring-2 ring-gray-950">
			<span className="sr-only">Something new may be forming in your taste</span>
		</span>
	)
}

/**
 * Variants "line", "dot" and "note": on Your taste mix, under the picker, one row per set that may be forming: what a
 * rating in this tab started first, then what the member's ratings hold now. Dashed and violet, as nothing on the page
 * is yet; no button but the titles.
 */
export function FormingNote() {
	const proto = useProto()
	const hint = useHint(proto)
	const { fired } = useFired()
	const variant = proto?.variant
	useEffect(() => {
		if (variant && variant !== "none") markSeen()
	}, [variant])
	if (!proto || proto.variant === "none") return null
	const sets = [...(fired ? [fired] : []), ...(hint?.now ?? []).filter((f) => !fired || !f.titles.some((t) => fired.titles.some((x) => x.key === t.key)))].slice(0, 2)
	if (!sets.length) return null
	return (
		<div className="mt-4 space-y-2">
			{sets.map((f) => (
				<div key={f.titles[0]?.key} className="flex items-center gap-3 rounded-xl border border-dashed border-violet-300/30 bg-violet-300/[0.04] p-2.5 pr-4">
					<Stack titles={f.titles} />
					<p className="min-w-0 flex-1 text-sm leading-snug text-gray-300">
						<span className="mr-2 inline-block text-xs font-semibold uppercase tracking-[0.08em] text-violet-200">{COPY.noteLabel}</span>
						{f.titles.map((t, i) => (
							<span key={t.key}>
								{i === 0 ? "You love " : i === f.titles.length - 1 ? " and " : ", "}
								<Link to={href(t)} className="font-semibold text-white hover:underline">
									{t.title}
								</Link>
							</span>
						))}
						, and they go together, but they aren't in your mix yet. <span className="text-gray-400">{COPY.needs}</span>
					</p>
				</div>
			))}
		</div>
	)
}
