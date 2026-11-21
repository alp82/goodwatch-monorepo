// PROTOTYPE - throwaway (prototype/explore-r5, slot "tray", variant "tray"). A tray that keeps ingredients while you
// browse. Three ways in: the small + that appears on any place's card or link when you point at it, dragging a card
// onto the tray, and "+ this place" in the tray itself on a place's page (on a phone: press and hold a card). With
// two or more in it the tray names the blend, shows three of its titles and opens it. Nothing is replaced; each
// ingredient has its own x. It lives in the corner so it never covers the page's own controls.
import { Link, useFetcher } from "@remix-run/react"
import { PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { type Address, type Ingredient, href, place, sortParts } from "../../../../kit/address"
import type { PlaceRef, ShowTitle } from "../../../../kit/types"
import { FOCUS, PlaceMark, poster } from "../../../../kit/ui"
import { nice } from "../../../blend/parts"
import { phrase, phraseText } from "../../../blend/phrase"
import type { SlotVariant } from "../../contract"
import { TRAY_COOKIE, type TrayProps } from "./slot"
import type { TrayData } from "./tray.server"

const MAX = 6

/** The place a link leads to, as "family:slug": only a link to one single place counts. */
function placeOf(link: string, data: TrayData): string | null {
	let u: URL
	try {
		u = new URL(link, "http://x")
	} catch {
		return null
	}
	const m = u.pathname.match(/^\/prototype\/explore\/[^/]+\/(?:movies|shows|all)\/([^/]+)\/(.+)$/)
	if (!m || u.searchParams.get("with")) return null
	const family = data.segs[m[1]]
	if (!family) return null
	const rest = m[2].split("/").filter(Boolean)
	if (family === "service") rest.shift()
	if (rest.length !== 1) return null
	const id = `${family}:${rest[0]}`
	return data.places[id] ? id : null
}

const OUTSIDE = "[data-tray], [data-proto-switcher], [data-tray-plus]"

/** Two rings that overlap: the tray's own mark. */
const Rings = ({ className = "" }: { className?: string }) => (
	<svg viewBox="0 0 26 16" aria-hidden className={className}>
		<circle cx="9" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
		<circle cx="17" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
	</svg>
)

function View({ address, to, data }: TrayProps & { data?: TrayData }) {
	const [held, setHeld] = useState<string[]>(data?.held ?? [])
	const [plus, setPlus] = useState<{ id: string; x: number; y: number } | null>(null)
	const [dropping, setDropping] = useState(false)
	const [lift, setLift] = useState(0)
	const [mounted, setMounted] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const hide = useRef<ReturnType<typeof setTimeout>>()
	const fetcher = useFetcher<{ data?: { view?: string; titles?: ShowTitle[] } }>()
	const [seen, setSeen] = useState<Record<string, ShowTitle[]>>({})
	const asked = useRef<string | null>(null)
	const heldKey = (data?.held ?? []).join(",")
	// Another tab or a navigation changed the cookie: follow it.
	// oxlint-disable-next-line react-hooks/exhaustive-deps -- compared by content
	useEffect(() => setHeld(data?.held ?? []), [heldKey])
	useEffect(() => setMounted(true), [])

	const save = useCallback((next: string[]) => {
		setHeld(next)
		document.cookie = `${TRAY_COOKIE}=${encodeURIComponent(next.join(","))}; path=/; max-age=2592000; samesite=lax`
	}, [])
	const latest = useRef(held)
	latest.current = held
	const addId = useCallback(
		(id: string) => {
			const now = latest.current
			if (now.includes(id) || now.length >= MAX) return
			save([...now, id])
			// A small nod, so the eye finds where it went.
			root.current?.animate([{ scale: "1" }, { scale: "1.045" }, { scale: "1" }], {
				duration: 320,
				easing: "cubic-bezier(.22,1,.36,1)",
			})
		},
		[save],
	)

	// The + on any link to a single place, and press-and-hold on touch.
	useEffect(() => {
		if (!data) return
		const linkOf = (target: EventTarget | null) => {
			const el = target instanceof Element ? target : null
			if (!el || el.closest(OUTSIDE)) return null
			const a = el.closest<HTMLAnchorElement>("a[href]")
			const id = a ? placeOf(a.getAttribute("href") ?? "", data) : null
			return a && id ? { a, id } : null
		}
		const over = (e: PointerEvent) => {
			if (e.pointerType !== "mouse") return
			if (e.target instanceof Element && e.target.closest("[data-tray-plus]")) {
				clearTimeout(hide.current)
				return
			}
			const hit = linkOf(e.target)
			if (!hit || latest.current.includes(hit.id)) {
				clearTimeout(hide.current)
				hide.current = setTimeout(() => setPlus(null), 160)
				return
			}
			clearTimeout(hide.current)
			const r = hit.a.getBoundingClientRect()
			// On a card: inside its top right corner. On a line of text: just after it.
			const card = r.height > 56
			setPlus({
				id: hit.id,
				x: card ? r.right - 38 : Math.min(window.innerWidth - 36, r.right + 4),
				y: card ? r.top + 8 : r.top + r.height / 2 - 14,
			})
		}
		const gone = () => setPlus(null)
		let press: ReturnType<typeof setTimeout> | undefined
		let start: { x: number; y: number } | null = null
		let swallow = false
		const down = (e: PointerEvent) => {
			if (e.pointerType === "mouse") return
			const hit = linkOf(e.target)
			if (!hit || latest.current.includes(hit.id)) return
			start = { x: e.clientX, y: e.clientY }
			press = setTimeout(() => {
				swallow = true
				addId(hit.id)
				navigator.vibrate?.(12)
			}, 480)
		}
		const move = (e: PointerEvent) => {
			if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) clearTimeout(press)
		}
		const up = () => {
			clearTimeout(press)
			start = null
		}
		const click = (e: MouseEvent) => {
			if (!swallow) return
			swallow = false
			e.preventDefault()
			e.stopPropagation()
		}
		const menu = (e: Event) => {
			if (start && linkOf(e.target)) e.preventDefault()
		}
		const dragStart = (e: globalThis.DragEvent) => {
			if (linkOf(e.target)) setDropping(true)
		}
		const dragEnd = () => setDropping(false)
		document.addEventListener("pointerover", over)
		document.addEventListener("pointerdown", down)
		document.addEventListener("pointermove", move)
		document.addEventListener("pointerup", up)
		document.addEventListener("pointercancel", up)
		document.addEventListener("click", click, true)
		document.addEventListener("contextmenu", menu)
		document.addEventListener("dragstart", dragStart)
		document.addEventListener("dragend", dragEnd)
		window.addEventListener("scroll", gone, { passive: true })
		return () => {
			document.removeEventListener("pointerover", over)
			document.removeEventListener("pointerdown", down)
			document.removeEventListener("pointermove", move)
			document.removeEventListener("pointerup", up)
			document.removeEventListener("pointercancel", up)
			document.removeEventListener("click", click, true)
			document.removeEventListener("contextmenu", menu)
			document.removeEventListener("dragstart", dragStart)
			document.removeEventListener("dragend", dragEnd)
			window.removeEventListener("scroll", gone)
			clearTimeout(press)
		}
	}, [data, addId])

	// Stay clear of the prototype's own panel: when it would sit over the tray, the tray rides above it.
	useEffect(() => {
		const measure = () => {
			const el = root.current
			if (!el) return
			// Where the tray rests, from its layout (its slide up is a transform and must not count).
			const left = el.offsetLeft
			const right = left + el.offsetWidth
			const base = window.innerHeight - (Number.parseFloat(getComputedStyle(el).bottom) || 0)
			let up = 0
			for (const panel of document.querySelectorAll("[data-proto-switcher]")) {
				const r = panel.getBoundingClientRect()
				if (r.left < right + 8 && r.right > left - 8 && r.top < base + 8)
					up = Math.max(up, base - r.top + 8)
			}
			setLift((was) => (Math.abs(was - up) > 1 ? up : was))
		}
		measure()
		const t = setInterval(measure, 700)
		window.addEventListener("resize", measure)
		return () => {
			clearInterval(t)
			window.removeEventListener("resize", measure)
		}
	}, [])

	const kind = address.kind
	const parts = useMemo(
		() =>
			sortParts(
				held.flatMap((id): Ingredient[] => {
					const p = data?.places[id]
					return p ? [{ family: p.family, slug: p.slug }] : []
				}),
			).map((p) => data?.places[`${p.family}:${p.slug}`] as PlaceRef),
		[held, data],
	)
	const blendKey = parts.map((p) => `${p.family}:${p.slug}`).join("+")
	const blendAt: Address = place(kind, parts, address.country)

	// Three posters of what the tray would open.
	useEffect(() => {
		if (parts.length < 2 || seen[`${kind}|${blendKey}`]) return
		const t = setTimeout(() => {
			asked.current = `${kind}|${blendKey}`
			fetcher.load(href("blend", blendAt, { peek: "1" }))
		}, 140)
		return () => clearTimeout(t)
		// oxlint-disable-next-line react-hooks/exhaustive-deps -- asks once per blend
	}, [blendKey, kind])
	useEffect(() => {
		const got = fetcher.data?.data
		if (fetcher.state !== "idle" || !asked.current || got?.view !== "peek") return
		const key = asked.current
		setSeen((s) => (s[key] ? s : { ...s, [key]: got.titles ?? [] }))
	}, [fetcher.state, fetcher.data])

	if (!data) return null
	const here =
		address.view === "place" && address.parts.length === 1
			? `${address.parts[0].family}:${address.parts[0].slug}`
			: null
	const offer = here && data.places[here] && !held.includes(here) ? data.places[here] : null
	const titles = seen[`${kind}|${blendKey}`]
	const empty = titles !== undefined && titles.length === 0
	const name = parts.length ? phraseText(phrase(kind, parts)) : ""

	const onDrop = (e: DragEvent) => {
		e.preventDefault()
		setDropping(false)
		const link = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain")
		const id = placeOf(link.split("\n")[0] ?? "", data)
		if (id) addId(id)
	}

	const chip =
		"flex h-8 shrink-0 items-center gap-1.5 rounded-full pr-1 pl-2.5 text-sm font-bold whitespace-nowrap"

	return (
		<>
			<div
				ref={root}
				data-tray=""
				onDragOver={(e) => {
					e.preventDefault()
					e.dataTransfer.dropEffect = "copy"
				}}
				onDrop={onDrop}
				className={`fixed bottom-[6.25rem] left-2 z-[55] w-[calc(100vw-1rem)] max-w-[21rem] rounded-2xl lg:max-w-[15.5rem] 2xl:max-w-[19rem] bg-[#0d1220]/95 text-gray-100 shadow-2xl shadow-black/60 ring-1 backdrop-blur transition-[translate,box-shadow] duration-300 ease-out lg:bottom-4 lg:left-4 ${
					dropping ? "ring-2 ring-amber-400" : "ring-white/15"
				}`}
				style={{ translate: `0 ${-lift}px` }}
			>
				{held.length === 0 ? (
					<div className="flex min-h-11 items-center gap-2.5 px-3.5 py-2">
						<Rings className="h-4 w-[26px] shrink-0 text-amber-300" />
						{offer ? (
							<>
								<span className="text-sm font-semibold text-gray-300">Start a blend with</span>
								<button
									type="button"
									onClick={() => addId(here as string)}
									className={`${chip} bg-white/[0.08] pr-3 ring-1 ring-white/20 transition-colors hover:bg-white/[0.16] ${FOCUS}`}
								>
									<PlusIcon className="-ml-1 h-4 w-4 text-gray-400" />
									<PlaceMark place={offer} size={13} />
									{nice(offer)}
								</button>
							</>
						) : (
							<p className="text-sm leading-snug text-gray-300">
								<span className="font-bold text-white">
									{dropping ? "Drop it here" : "Blend tray"}
								</span>
								<span className="max-lg:hidden">
									{dropping ? "" : " · press + on any mood, genre or country"}
								</span>
								<span className="lg:hidden">{dropping ? "" : " · press and hold a card"}</span>
							</p>
						)}
					</div>
				) : (
					<div className="px-3 pt-2.5 pb-3">
						<div className="flex items-center gap-2">
							<Rings className="h-4 w-[26px] shrink-0 text-amber-300" />
							<span className="text-[11px] font-bold tracking-[0.14em] text-gray-400 uppercase">
								Blend tray
							</span>
							<button
								type="button"
								onClick={() => save([])}
								className={`-mr-1 ml-auto rounded-full px-2 py-0.5 text-xs font-bold text-gray-400 hover:bg-white/10 hover:text-white ${FOCUS}`}
							>
								Empty it
							</button>
						</div>
						<ul className="mt-2 flex flex-wrap gap-1.5">
							{parts.map((p) => (
								<li
									key={`${p.family}:${p.slug}`}
									className={`${chip} bg-white/[0.09] ring-1 ring-white/15`}
								>
									<PlaceMark place={p} size={13} />
									<span className={p.family === "decade" ? "tabular-nums" : ""}>{nice(p)}</span>
									<button
										type="button"
										aria-label={`Take ${p.label} out of the tray`}
										onClick={() => save(held.filter((id) => id !== `${p.family}:${p.slug}`))}
										className={`grid h-6 w-6 place-items-center rounded-full text-gray-400 hover:bg-white/15 hover:text-white ${FOCUS}`}
									>
										<XMarkIcon className="h-3.5 w-3.5" />
									</button>
								</li>
							))}
							{offer && held.length < MAX && (
								<li>
									<button
										type="button"
										onClick={() => addId(here as string)}
										className={`${chip} border border-dashed border-white/30 pr-3 text-gray-200 transition-colors hover:bg-white/10 ${FOCUS}`}
									>
										<PlusIcon className="-ml-1 h-4 w-4 text-gray-400" />
										<PlaceMark place={offer} size={13} />
										{nice(offer)}
									</button>
								</li>
							)}
						</ul>
						{parts.length < 2 ? (
							<p className="mt-2.5 text-sm leading-snug text-gray-400">
								One more makes a blend.
								<span className="max-lg:hidden">
									{" "}
									Point at any mood, genre, decade or country and press +.
								</span>
								<span className="lg:hidden"> Press and hold any card.</span>
							</p>
						) : (
							<div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-3">
								<div className="flex shrink-0 -space-x-2">
									{[0, 1, 2].map((i) => {
										const t = titles?.[i]
										return (
											<span
												key={t?.card.key ?? `empty-${i}`}
												className="block h-[54px] w-9 overflow-hidden rounded-[4px] bg-white/[0.06] ring-1 ring-black/40"
											>
												{t?.card.poster_path && (
													<img
														src={poster(t.card.poster_path, "w92")}
														alt={t.card.title}
														className="h-full w-full object-cover"
													/>
												)}
											</span>
										)
									})}
								</div>
								<div className="min-w-0 flex-1">
									<p className="line-clamp-2 font-display text-[15px] leading-tight font-bold text-white">
										{name}
									</p>
									{empty ? (
										<p className="mt-1 text-xs leading-snug text-gray-400">
											Nothing is all of that at once. Take one out.
										</p>
									) : (
										<Link
											to={to(blendAt)}
											prefetch="intent"
											onClick={() => save([])}
											className={`mt-1.5 inline-flex h-8 items-center gap-1 rounded-full bg-white px-3.5 text-sm font-bold text-gray-950 transition-colors hover:bg-amber-300 ${FOCUS}`}
										>
											Open this blend <span aria-hidden>›</span>
										</Link>
									)}
								</div>
							</div>
						)}
					</div>
				)}
			</div>
			{mounted &&
				plus &&
				createPortal(
					<button
						type="button"
						data-tray-plus=""
						aria-label={`Add ${data.places[plus.id]?.label} to the blend tray`}
						title={`Add ${data.places[plus.id]?.label} to the blend tray`}
						onClick={() => {
							addId(plus.id)
							setPlus(null)
						}}
						onPointerLeave={() => {
							clearTimeout(hide.current)
							hide.current = setTimeout(() => setPlus(null), 160)
						}}
						className="fixed z-[56] grid h-7 w-7 place-items-center rounded-full bg-white text-gray-950 shadow-lg shadow-black/50 ring-1 ring-black/10 transition-transform duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:ring-amber-400"
						style={{ left: plus.x, top: plus.y }}
					>
						<PlusIcon className="h-4 w-4" />
					</button>,
					document.body,
				)}
		</>
	)
}

export const variant: SlotVariant<never, TrayProps & { data?: TrayData }> = {
	id: "tray",
	name: "Tray",
	what: "A tray in the corner keeps ingredients while you browse: press the + on any card (or drag the card in), and with two it names the blend, shows three titles and opens it.",
	order: 1,
	View,
}
