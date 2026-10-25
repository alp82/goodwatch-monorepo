// PROTOTYPE - throwaway. The Feedback tab on every page (round 4), mounted by the root layout in development. It looks
// up the open page's type in areas.ts, finds that type's parts on the page, and offers "Fix something on this page"
// when at least one is there: fix mode outlines each found part with a Fix or Flag badge over the scrim, the panel lists
// them, and a picked part asks its chips. Pages without parts (settings, support, sign in, …) get Send feedback only.
// The feedback prototype route mounts its own dock with the richer title and person flows, so this one steps aside.
// `?as=member|trusted` plays a signed-in reader (the sandbox has no sign-in). Nothing is sent.
import {
	CheckCircleIcon,
	ClockIcon,
	FlagIcon,
	PencilSquareIcon,
} from "@heroicons/react/20/solid"
import { useLocation, useMatches } from "@remix-run/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { PrimaryButton } from "~/ui/auth/kit"
import {
	FeedbackDock,
	type FixPath,
	GuestEmail,
	INPUT,
	thanksLine,
	useFixFlow,
} from "~/ui/prototype-feedback/FeedbackDock"
import {
	type PageArea,
	SOMETHING_ELSE,
	chipsOf,
	kindOf,
	pageTypeOf,
} from "~/ui/prototype-feedback/areas"
import {
	DimHeader,
	Scrim,
	reveal,
	shown,
	useFadePresence,
} from "~/ui/prototype-feedback/fix-scrim"
import { useUser } from "~/utils/auth"

type Viewer = "guest" | "member" | "trusted"

/** "Rows on the TV" → "rows on the TV". */
const lc = (name: string) => name[0].toLowerCase() + name.slice(1)

/** The area's element on the page: per selector in order, the visible matches minus those holding another match, first
 *  in page order. */
export function findArea(a: PageArea): HTMLElement | null {
	for (const sel of [a.selector].flat()) {
		const all = Array.from(document.querySelectorAll<HTMLElement>(sel)).filter(
			(el) => shown(el) && !el.closest("[data-feedback-private]"),
		)
		const el = all.find((e) => !all.some((o) => o !== e && e.contains(o)))
		if (el) return el
	}
	return null
}

const NONE: PageArea[] = []

type Box = { id: string; x: number; y: number; w: number; h: number }

/** The found parts' boxes in page coordinates, kept current through resizes, late content and sticky bars. */
function useBoxes(areas: PageArea[], on: boolean) {
	const [boxes, setBoxes] = useState<Box[]>([])
	useEffect(() => {
		if (!on) {
			setBoxes((b) => (b.length ? [] : b))
			return
		}
		let frame = 0
		let last = ""
		const measure = () => {
			frame = 0
			const next: Box[] = []
			for (const a of areas) {
				const el = findArea(a)
				if (!el) continue
				const r = el.getBoundingClientRect()
				next.push({
					id: a.id,
					x: Math.round(r.left + window.scrollX),
					y: Math.round(r.top + window.scrollY),
					w: Math.round(r.width),
					h: Math.round(r.height),
				})
			}
			const key = JSON.stringify(next)
			if (key === last) return
			last = key
			setBoxes(next)
			// The scrim measures its cut-outs from these boxes once they've rendered.
			requestAnimationFrame(() => window.dispatchEvent(new Event("fix-layout")))
		}
		const later = () => {
			if (!frame) frame = requestAnimationFrame(measure)
		}
		measure()
		const ro = new ResizeObserver(later)
		ro.observe(document.body)
		window.addEventListener("resize", later)
		window.addEventListener("scroll", later, { passive: true })
		const t = window.setTimeout(later, 500)
		return () => {
			ro.disconnect()
			window.removeEventListener("resize", later)
			window.removeEventListener("scroll", later)
			window.clearTimeout(t)
			cancelAnimationFrame(frame)
		}
	}, [areas, on])
	return boxes
}

/** Fix mode's outlines and badges, above the scrim, in page coordinates. */
function Outlines({
	areas,
	boxes,
	lit,
	setHot,
	pick,
	shown: visible,
}: {
	areas: PageArea[]
	boxes: Box[]
	lit: string | null
	setHot: (id: string | null) => void
	pick: (id: string) => void
	/** False while fading out (and for the frame before fading in). */
	shown: boolean
}) {
	// A box clipped to the page's width, so an outline round a full-width part never makes the page scroll sideways.
	return createPortal(
		<div
			data-feedback-private
			data-global-fix
			{...(!visible && { inert: "" })}
			className={`pointer-events-none absolute top-0 left-0 z-[1000] overflow-clip transition-opacity duration-200 ease-out motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}
			style={{
				width: document.documentElement.clientWidth,
				height: document.documentElement.scrollHeight,
			}}
		>
			{boxes.map((b) => {
				const a = areas.find((x) => x.id === b.id)
				if (!a) return null
				const flagOnly = kindOf(a) === "flag"
				const on = lit === b.id
				return (
					<button
						key={b.id}
						type="button"
						data-fix-overlay={b.id}
						data-lit={on || undefined}
						aria-label={`${flagOnly ? "Flag" : "Fix"} ${a.name}`}
						onPointerEnter={() => setHot(b.id)}
						onPointerLeave={() => setHot(null)}
						onFocus={() => setHot(b.id)}
						onBlur={() => setHot(null)}
						onClick={() => pick(b.id)}
						className={`absolute top-0 left-0 cursor-pointer rounded-2xl border-2 border-dashed transition-[opacity,background-color,border-color] duration-100 ${visible ? "pointer-events-auto" : ""} ${on ? "border-solid border-amber-400 bg-amber-400/[0.07]" : flagOnly ? "border-white/40" : "border-amber-500/70"}`}
						style={{
							transform: `translate(${b.x - 4}px, ${b.y - 4}px)`,
							width: b.w + 8,
							height: b.h + 8,
						}}
					>
						<span
							data-fix-badge
							className={`absolute -top-3 right-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-lg transition-transform duration-100 ${on ? "scale-110" : ""} ${flagOnly ? "bg-gray-200 text-gray-950" : "bg-amber-400 text-gray-950"}`}
						>
							{flagOnly ? (
								<FlagIcon className="size-3.5" aria-hidden />
							) : (
								<PencilSquareIcon className="size-3.5" aria-hidden />
							)}
							{flagOnly ? "Flag" : "Fix"} {lc(a.name)}
						</span>
					</button>
				)
			})}
		</div>,
		document.body,
	)
}

const LABEL =
	"mb-2 block text-[11px] font-semibold uppercase tracking-[.12em] text-gray-500"

/** A picked part's questions: one chip, a few words, a guest's optional email, Send. */
function AreaFlow({
	area,
	viewer,
	onClose,
}: { area: PageArea; viewer: Viewer; onClose: () => void }) {
	const [chip, setChip] = useState<number | null>(null)
	const [note, setNote] = useState("")
	const [email, setEmail] = useState("")
	const [sent, setSent] = useState(false)
	// Inside the Feedback panel: sending ends fix mode's page layer, Done closes the panel.
	const flow = useFixFlow()
	const chips = chipsOf(area)
	const picked = chip === null ? null : chips[chip]
	const other = picked?.label === SOMETHING_ELSE
	const guest = viewer === "guest"
	if (sent && picked) {
		const isFix = picked.kind === "fix"
		return (
			<div className="flex flex-col gap-4 py-1" aria-live="polite">
				<div className="flex items-start gap-3">
					<span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
						<CheckCircleIcon className="size-6" />
					</span>
					<div>
						<p className="text-lg font-semibold text-white">
							{isFix ? "Thanks, we'll review it" : "Thanks, we'll take a look"}
						</p>
						<p className="mt-0.5 text-sm text-gray-400">
							{isFix
								? "Someone on the team checks it, usually within a few days."
								: "This part isn't edited by hand. We check the source and fix the match."}{" "}
							{thanksLine(guest, email)}
						</p>
					</div>
				</div>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => {
							setSent(false)
							setChip(null)
							setNote("")
							flow?.again()
						}}
						className="min-h-10 cursor-pointer rounded-xl px-4 font-semibold text-gray-300 hover:bg-white/10"
					>
						Report something else
					</button>
					<button
						type="button"
						onClick={flow?.done ?? onClose}
						className="ml-auto min-h-10 cursor-pointer rounded-xl bg-white px-5 font-semibold text-black hover:bg-gray-200"
					>
						Done
					</button>
				</div>
			</div>
		)
	}
	return (
		<div className="flex flex-col gap-5" data-area-flow={area.id}>
			<div>
				<span className={LABEL}>What's wrong?</span>
				<div className="flex flex-wrap gap-2">
					{chips.map((c, i) => (
						<button
							key={c.label}
							type="button"
							aria-pressed={chip === i}
							onClick={() => setChip(i)}
							className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${chip === i ? "bg-white font-semibold text-black" : "bg-white/8 text-gray-200 hover:bg-white/15"}`}
						>
							{c.kind === "flag" && (
								<FlagIcon className="size-3.5 opacity-60" aria-hidden />
							)}
							{c.label}
						</button>
					))}
				</div>
			</div>
			{picked && (
				<label className="flex flex-col gap-1.5">
					<span className="text-sm font-medium text-gray-300">
						{other ? "What's wrong?" : "Anything to add?"}{" "}
						{!other && (
							<span className="font-normal text-gray-500">(optional)</span>
						)}
					</span>
					<textarea
						value={note}
						onChange={(e) => setNote(e.target.value)}
						rows={3}
						placeholder={
							picked.kind === "fix"
								? "Which one, and what it should be"
								: "Which one, and what looks off"
						}
						className={`${INPUT} py-2.5`}
					/>
				</label>
			)}
			{picked && guest && <GuestEmail value={email} onChange={setEmail} />}
			<div className="sticky -bottom-4 -mx-4 mt-1 border-t border-white/10 bg-gray-950 px-4 pt-3 pb-5 sm:-mx-5 sm:px-5">
				{picked && (
					<p className="mb-2 flex items-center gap-1.5 text-xs text-gray-400">
						{picked.kind === "fix" ? (
							<>
								<ClockIcon className="size-4" aria-hidden />
								{guest
									? "We check it before it shows"
									: "Staff check it before it shows"}
							</>
						) : (
							<>
								<FlagIcon className="size-4" aria-hidden /> We look into it.
								This part isn't edited by hand.
							</>
						)}
					</p>
				)}
				<PrimaryButton
					type="button"
					disabled={!picked || (other && !note.trim())}
					onClick={() => {
						setSent(true)
						flow?.sent()
					}}
				>
					Send
				</PrimaryButton>
			</div>
		</div>
	)
}

/** The root layout's dock: every page but the feedback prototype, which mounts its own. */
export function RootFeedbackDock({
	sendOnly = false,
}: {
	/** An error page: nothing on it to fix. */
	sendOnly?: boolean
}) {
	const { user } = useUser()
	const own = useMatches().some((m) => m.id === "routes/prototype.feedback")
	const { pathname, search } = useLocation()
	const as = new URLSearchParams(search).get("as")
	const viewer: Viewer =
		as === "trusted" || as === "member" ? as : user ? "member" : "guest"
	const type = pageTypeOf(pathname)
	const areas = (!sendOnly && type?.areas) || NONE

	// Which of the type's parts this page shows now: checked on arrival, a little later (late data), and whenever the
	// pointer or focus reaches the tab, before it opens.
	const [found, setFound] = useState<string[]>([])
	const check = useCallback(() => {
		const ids = areas.filter((a) => findArea(a)).map((a) => a.id)
		setFound((f) => (f.join() === ids.join() ? f : ids))
	}, [areas])
	useEffect(() => {
		check()
		const t1 = window.setTimeout(check, 400)
		const t2 = window.setTimeout(check, 1500)
		const tab = document.querySelector("[data-feedback-tab]")
		tab?.addEventListener("pointerenter", check)
		tab?.addEventListener("focus", check)
		return () => {
			window.clearTimeout(t1)
			window.clearTimeout(t2)
			tab?.removeEventListener("pointerenter", check)
			tab?.removeEventListener("focus", check)
		}
	}, [check, pathname])

	const [on, setOn] = useState(false)
	const [done, setDone] = useState(false)
	const [hot, setHot] = useState<string | null>(null)
	const [picked, setPicked] = useState<string | null>(null)
	// The page layer: outlines, badges and scrim. A sent report ends it while the panel keeps its thanks; every way out
	// of fix mode fades it, then takes it out of the page.
	const layer = on && !done
	const fade = useFadePresence(layer)
	const live = useMemo(
		() => areas.filter((a) => found.includes(a.id)),
		[areas, found],
	)
	const boxes = useBoxes(live, fade.mounted)
	const pickedArea = live.find((a) => a.id === picked) ?? null
	const revealRef = useRef((id: string) => {
		const a = live.find((x) => x.id === id)
		if (a) reveal(findArea(a))
	})
	revealRef.current = (id: string) => {
		const a = live.find((x) => x.id === id)
		if (a) reveal(findArea(a))
	}
	useEffect(() => {
		setOn(false)
		setDone(false)
		setPicked(null)
		setHot(null)
	}, [pathname])

	if (own) return null
	const fix: FixPath | undefined = live.length
		? {
				on,
				setOn: (v) => {
					setOn(v)
					setDone(false)
					if (!v) {
						setPicked(null)
						setHot(null)
					}
				},
				done,
				setDone,
				element: (id) => {
					const a = live.find((x) => x.id === id)
					return a ? findArea(a) : null
				},
				trusted: viewer === "trusted",
				picked: pickedArea
					? {
							id: pickedArea.id,
							title: `${kindOf(pickedArea) === "flag" ? "Flag" : "Fix"} ${lc(pickedArea.name)}`,
							flow: (
								<AreaFlow
									key={pickedArea.id}
									area={pickedArea}
									viewer={viewer}
									onClose={() => setPicked(null)}
								/>
							),
						}
					: null,
				closePicked: () => setPicked(null),
				areas: live.map((a) => ({
					id: a.id,
					label: a.name,
					flagOnly: kindOf(a) === "flag",
				})),
				hot,
				setHot,
				pick: (id) => {
					setDone(false)
					setPicked(id)
				},
				reveal: (id) => revealRef.current(id),
			}
		: undefined
	return (
		<>
			<FeedbackDock key={pathname} fix={fix} guest={viewer === "guest"} />
			<DimHeader on={layer} />
			<Scrim on={layer} />
			{fade.mounted && (
				<Outlines
					areas={live}
					boxes={boxes}
					lit={picked ?? hot}
					setHot={setHot}
					shown={fade.shown}
					pick={(id) => {
						setDone(false)
						setPicked(id)
					}}
				/>
			)}
		</>
	)
}
