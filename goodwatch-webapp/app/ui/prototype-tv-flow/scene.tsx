// PROTOTYPE - throwaway. "Which TV screens exist, how do you move between them, and how do you leave for a real
// page?" Three flow variants of the start page's TV, in the real room with the reworked Remote (hug-arc, the
// verdict of prototype/living-room-remote), switchable via `?variant=` and the pill (or the [ and ] keys; the
// arrow keys belong to the TV):
//   rows    tabs, a hero, rows of tiles (a streaming box's home)
//   apps    a dashboard of large app tiles, each app opens on the TV (a console)
//   guided  one question per screen, a path that ends on one title (a TV's setup)
// Leaving the TV is always the expand control: corner brackets around a small picture and a short label. On OK
// the brackets travel to the edge of the TV picture, then the picture grows past the TV into the window, and the
// real page is there. Each variant places and paces it differently, see the README.
//   &as=guest|member     the person (P)
//   &view=room|tv        the room with the Remote, or the TV alone, large (V)
//   &label=expand|...    the expand control's label (L)
//   &at=home.discover-cozy   the stack of TV screens, so every screen has an address
//   &f=<item>            the focused item on arrival
//   &hold                freezes the expand run for screenshots: window.__tvLeave(0..1)
// Sample data only: nothing is read or written. Notes and screenshots: docs/prototypes/tv-screen-flow/README.md.
import { useSearchParams } from "@remix-run/react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { HAND_IMAGE, REMOTE_H, REMOTE_TILT_DEG, REMOTE_W, ROOM, TV_CANVAS, layoutRoom } from "~/ui/living-room/room"
import type { TvAction } from "~/ui/living-room/tv-flow"
import { HugRemote } from "~/ui/prototype-remote/RemoteVariants"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { assetUrl } from "~/utils/asset-url"
import { AppsTv } from "./apps"
import { LABELS, type Rect, TvCtx, VARIANTS, type Variant, parseId, useTvEngine } from "./engine"
import { GuidedTv } from "./guided"
import { AMBER, Corners, TV_CSS, Toast } from "./kit"
import { RowsTv } from "./rows"

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

/** The phone edition's canvas: taller than the TV on the wall, so the same type prints at a readable size. */
const PHONE_CANVAS = { w: 560, h: 640 }

const SERVICE_NAMES: Record<string, string> = { netflix: "Netflix", prime: "Prime Video", disney: "Disney+", hulu: "Hulu" }

const clamp = (n: number) => Math.max(0, Math.min(1, n))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({ left: lerp(a.left, b.left, t), top: lerp(a.top, b.top, t), width: lerp(a.width, b.width, t), height: lerp(a.height, b.height, t) })
const inset = (r: Rect, by: number): Rect => ({ left: r.left + by, top: r.top + by, width: r.width - 2 * by, height: r.height - 2 * by })
const easeOut = (t: number) => 1 - (1 - t) ** 3
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

export function TvFlowScene() {
	const [params, setParams] = useSearchParams()
	const variant = ((params.get("variant") ?? "") in VARIANTS ? params.get("variant") : "rows") as Variant
	const member = params.get("as") === "member"
	const tvOnly = params.get("view") === "tv"
	const labelKey = (params.get("label") ?? "") in LABELS ? (params.get("label") as string) : "expand"

	const root = useRef<HTMLDivElement>(null)
	const [size, setSize] = useState<{ w: number; h: number } | null>(null)
	useIsoLayoutEffect(() => {
		const el = root.current
		if (!el) return
		const measure = () => setSize((s) => (s && s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }))
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	const phone = Boolean(size && size.w < 768)
	const tv = useTvEngine({ variant, member, phone, label: LABELS[labelKey], scene: root, ready: Boolean(size) })

	const set = (next: Record<string, string>) => {
		const p = new URLSearchParams(params)
		for (const [k, v] of Object.entries(next)) v === "" ? p.delete(k) : p.set(k, v)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const controls = {
		person: () => set({ as: member ? "" : "member" }),
		view: () => set({ view: tvOnly ? "" : "tv" }),
		variant: () => {
			const keys = Object.keys(VARIANTS)
			set({ variant: keys[(keys.indexOf(variant) + 1) % keys.length] })
		},
		label: () => {
			const keys = Object.keys(LABELS)
			const next = keys[(keys.indexOf(labelKey) + 1) % keys.length]
			set({ label: next === "expand" ? "" : next })
		},
	}
	const latest = useRef({ controls, typing: tv.top === "search" })
	latest.current = { controls, typing: tv.top === "search" }
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (latest.current.typing || e.metaKey || e.ctrlKey || e.altKey) return
			if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return
			const key = e.key.toLowerCase()
			if (key === "p") latest.current.controls.person()
			if (key === "v") latest.current.controls.view()
			if (key === "l") latest.current.controls.label()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [])

	const canvas = phone ? PHONE_CANVAS : TV_CANVAS
	const L = useMemo(() => {
		if (!size) return null
		const { w, h } = size
		if (phone) {
			const tvH = Math.min(h * 0.66, (w * canvas.h) / canvas.w)
			const tvW = (tvH * canvas.w) / canvas.h
			const scale = Math.max(0.3, Math.min((h - tvH - 14) / 452, (w * 0.56) / REMOTE_W))
			return { room: null, tv: { left: (w - tvW) / 2, top: 0, width: tvW, height: tvH }, remote: { left: w / 2 - (REMOTE_W * scale) / 2, top: tvH + 14, scale } }
		}
		if (tvOnly) {
			const s = Math.min((w - 80) / canvas.w, (h - 80) / canvas.h)
			return { room: null, tv: { left: (w - canvas.w * s) / 2, top: (h - canvas.h * s) / 2, width: canvas.w * s, height: canvas.h * s }, remote: null }
		}
		const room = layoutRoom(w, h)
		return { room, tv: room.tv, remote: room.remote }
	}, [size, phone, tvOnly, canvas])

	// ---- The expand run: `arm` is the brackets' way to the edge of the picture, `grow` the picture's way to the window.
	const run = tv.leaving
	const arm = run ? (run.arm > 0 ? clamp(run.p / run.arm) : 1) : 0
	const grow = run ? clamp((run.p - run.arm) / (1 - run.arm)) : 0
	const landed = Boolean(run && run.p >= 1)
	const windowRect: Rect = { left: 0, top: 0, width: size?.w ?? 0, height: size?.h ?? 0 }
	const tvRect = L ? (run ? lerpRect(L.tv, windowRect, easeInOut(grow)) : L.tv) : null
	// In "apps" the focused expand control already frames the whole picture, a little smaller, ready to grow.
	const framed = variant === "apps" && tv.focus === "expand" && !run && tv.top !== "menu" && tv.store.power === "on"
	const pictureScale = framed ? 0.95 : run && variant === "apps" ? 0.95 + 0.05 * clamp(grow / 0.35) : 1
	const brackets = !L || !tvRect ? null : run ? (grow > 0 ? inset(tvRect, 10) : lerpRect(run.from, inset(L.tv, 10), easeOut(arm))) : framed ? inset(L.tv, 10) : null
	const bracketsLen = brackets ? Math.max(12, Math.min(72, Math.min(brackets.width, brackets.height) * 0.17)) : 0

	const dispatch = (action: TvAction) => {
		switch (action.type) {
			case "step":
				return tv.step(action.by)
			case "back":
				return tv.back()
			case "home":
				return tv.home()
			case "toggle-menu":
				return tv.toggleMenu()
			case "open-search":
				return tv.openSearch()
			case "service-key":
				return tv.service(action.service)
			case "power":
				return tv.power(action.on)
		}
	}
	const remote = L?.remote && (
		<div
			className="absolute"
			style={{ left: L.remote.left, top: L.remote.top, width: REMOTE_W * L.remote.scale, height: REMOTE_H * L.remote.scale, transformOrigin: "50% 100%", transform: phone ? undefined : `perspective(1400px) rotateX(${REMOTE_TILT_DEG}deg)` }}
		>
			{L.room && (
				<picture>
					<source type="image/avif" srcSet={assetUrl(HAND_IMAGE.avif)} />
					<img src={assetUrl(HAND_IMAGE.webp)} alt="" aria-hidden className="pointer-events-none absolute max-w-none select-none" style={L.room.hand} draggable={false} />
				</picture>
			)}
			<div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${L.remote.scale})` }}>
				<HugRemote
					streaming="arc"
					screen={parseId(tv.top)[0] === "search" ? { name: "search", query: null } : { name: "home" }}
					power={tv.store.power}
					menuOpen={tv.top === "menu"}
					lcd={["", ""]}
					serviceName={(key) => SERVICE_NAMES[key]}
					activeService={tv.store.service}
					dispatch={dispatch}
					onOk={tv.ok}
					onDirection={tv.move}
				/>
			</div>
		</div>
	)

	const s = tvRect ? Math.max(tvRect.width / canvas.w, tvRect.height / canvas.h) : 1
	return (
		<div ref={root} className="living-room fixed inset-x-0 bottom-16 top-16 z-40 overflow-clip bg-[#07080b] text-white lg:bottom-0">
			<style>{TV_CSS}</style>
			{L?.room && (
				<div className="absolute" style={L.room.photo}>
					<img src={assetUrl(ROOM.fallback)} srcSet={ROOM.webp} sizes="100vw" alt={ROOM.alt} width={ROOM.w} height={ROOM.h} className="absolute inset-0 h-full w-full select-none" draggable={false} />
					<div className="absolute inset-0 bg-[#05060a] transition-opacity duration-700" style={{ opacity: tv.store.power === "on" ? 0.12 : 0.6 }} />
				</div>
			)}
			{L && tvRect && (
				<div data-tv-screen className="absolute overflow-hidden rounded-[3px] bg-black" style={{ ...tvRect, zIndex: run ? 30 : undefined, boxShadow: L.room && tv.store.power === "on" ? "0 0 90px 8px rgba(251,191,36,0.16), 0 0 18px 1px rgba(251,191,36,0.2)" : "none" }}>
					<div className="absolute left-0 top-0 origin-top-left bg-[#0a0c11] text-white" style={{ width: canvas.w, height: canvas.h, transform: `translate(${(tvRect.width - canvas.w * s) / 2}px, ${(tvRect.height - canvas.h * s) / 2}px) scale(${s})` }}>
						<TvCtx.Provider value={tv}>
							{tv.store.power === "off" ? (
								<div className="absolute inset-0 bg-black" aria-hidden />
							) : (
								<div className="absolute inset-0" style={{ transform: `scale(${pictureScale})`, transition: run ? undefined : "transform .2s ease-out" }}>
									{variant === "rows" ? <RowsTv /> : variant === "apps" ? <AppsTv /> : <GuidedTv />}
									<Toast />
								</div>
							)}
						</TvCtx.Provider>
					</div>
					{L.room && <div className="tv-glass pointer-events-none absolute inset-0 rounded-[3px]" />}
				</div>
			)}
			{remote}

			{/* The real page, standing in: it fades in while the picture is still growing. */}
			{run && grow > 0.7 && (
				<div className="absolute inset-0 z-[35] overflow-auto bg-[#0d1016]" style={{ opacity: clamp((grow - 0.7) / 0.25), pointerEvents: landed ? undefined : "none" }}>
					<div className="mx-auto flex min-h-full max-w-5xl flex-col px-6 py-10">
						<div className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">The real page (a stand-in)</div>
						<h1 className="mt-2 text-5xl font-extrabold tracking-tight">{run.dest.name}</h1>
						<div className="mt-3 font-mono text-lg text-white/60">goodwatch.app{run.dest.href}</div>
						{run.dest.carries && <div className="mt-2 text-lg text-white/80">Comes along from the TV: {run.dest.carries}.</div>}
						<div className="mt-8 grid flex-1 grid-cols-3 gap-4 sm:grid-cols-6">
							{Array.from({ length: 12 }, (_, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
								<div key={i} className="aspect-[2/3] rounded-xl bg-white/[0.06]" />
							))}
						</div>
						<div className="mt-8 flex flex-wrap items-center gap-4">
							<button type="button" onClick={tv.back} className="rounded-full bg-white px-6 py-3 text-lg font-bold text-black">
								← Back to the TV
							</button>
							<span className="text-white/60">Browser Back does this in the real app: the page shrinks into the TV screen you left.</span>
						</div>
					</div>
				</div>
			)}
			{brackets && (
				<div className="pointer-events-none absolute z-[36]" style={{ ...brackets, opacity: run ? 1 - clamp((grow - 0.7) / 0.25) : 1, transition: run ? undefined : "opacity .2s" }}>
					<Corners len={bracketsLen} stroke={Math.max(3, bracketsLen * 0.13)} color={AMBER} />
				</div>
			)}

			{/* Prototype controls, not part of the design. */}
			<div className={`absolute z-50 flex gap-1.5 text-[13px] font-semibold text-black ${phone ? "bottom-3 left-2 flex-col" : "left-3 top-3 items-center"}`}>
				{phone && (
					<button type="button" onClick={controls.variant} className="rounded-full bg-white px-3 py-1.5 shadow-xl ring-2 ring-fuchsia-500">
						{variant} →
					</button>
				)}
				<button type="button" onClick={controls.person} className="rounded-full bg-white px-3 py-1.5 shadow-xl ring-2 ring-fuchsia-500" title="P">
					{member ? "Member" : "Guest"}
				</button>
				{!phone && (
					<button type="button" onClick={controls.view} className="rounded-full bg-white px-3 py-1.5 shadow-xl ring-2 ring-fuchsia-500" title="V">
						{tvOnly ? "TV only" : "In the room"}
					</button>
				)}
				<button type="button" onClick={controls.label} className="rounded-full bg-white px-3 py-1.5 shadow-xl ring-2 ring-fuchsia-500" title="L">
					“{LABELS[labelKey]}”
				</button>
				{!phone && (
					<span className="rounded-full bg-black/80 px-3 py-1.5 font-mono text-[12px] font-normal text-white/90">
						{tv.stack.join(" › ")} · focus {tv.focus ?? "none"}
						{run ? ` · ${landed ? "on" : run.dir < 0 ? "back from" : "expanding to"} ${run.dest.href}` : ""}
					</span>
				)}
			</div>
			{!phone && <PrototypeSwitcher variants={VARIANTS} keys={["[", "]"]} position="bottom-6 right-6" />}
		</div>
	)
}
