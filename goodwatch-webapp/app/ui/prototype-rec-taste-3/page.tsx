// PROTOTYPE - throwaway. The Taste page shell: how the subnav moves between sections. ?shell= picks one.
//   tabs      (existing) sticky tabs under the app header, one section at a time
//   rail      (existing) a rail of sections with a poster and a teaser each; a scrollable strip on mobile
//   chapters  (bolder)   every section in one scroll, with a sticky chapter bar that tracks your progress
import { useSearchParams } from "@remix-run/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { CONDENSED, GoContext, ShellContext, poster } from "./kit3"
import type { Payload3 } from "./model"
import { sectionTitles } from "./meta"
import { SECTIONS, type SectionDef } from "./sections"
import { VARIANTS } from "./variants"

export const SHELLS: Record<
	string,
	{ name: string; style: "existing" | "bolder" }
> = {
	tabs: { name: "Tabs", style: "existing" },
	rail: { name: "Rail", style: "existing" },
	chapters: { name: "Chapters", style: "bolder" },
}

export function TastePage({ data }: { data: Payload3 }) {
	const [params, setParams] = useSearchParams()
	const shell = SHELLS[params.get("shell") ?? ""]
		? (params.get("shell") as string)
		: "tabs"
	const variantKey = params.get("variant")
	const asked = params.get("section")
	const section = SECTIONS.some((s) => s.id === asked)
		? (asked as string)
		: variantKey && VARIANTS[variantKey]
			? VARIANTS[variantKey].section
			: "overview"

	const go = useCallback(
		(id: string) => {
			if (shell === "chapters") {
				document
					.getElementById(`t3-${id}`)
					?.scrollIntoView({ behavior: "smooth", block: "start" })
				return
			}
			const p = new URLSearchParams(window.location.search)
			p.set("section", id)
			setParams(p, { replace: true, preventScrollReset: true })
			window.scrollTo({ top: 0 })
		},
		[shell, setParams],
	)

	// Switching the variant opens the section it belongs to.
	const prev = useRef(variantKey)
	useEffect(() => {
		if (prev.current === variantKey) return
		prev.current = variantKey
		const v = variantKey ? VARIANTS[variantKey] : undefined
		if (v) go(v.section)
	}, [variantKey, go])

	// Chapters opened with a section or a variant in the URL start there.
	useEffect(() => {
		if (shell === "chapters" && (asked || variantKey))
			document
				.getElementById(`t3-${section}`)
				?.scrollIntoView({ block: "start" })
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shell])

	return (
		<ShellContext.Provider value={shell}>
			<GoContext.Provider value={go}>
				<div className="min-h-screen text-white">
					{shell === "tabs" && (
						<Tabs data={data} section={section} go={go} />
					)}
					{shell === "rail" && (
						<Rail data={data} section={section} go={go} />
					)}
					{shell === "chapters" && <Chapters data={data} go={go} />}
				</div>
			</GoContext.Provider>
		</ShellContext.Provider>
	)
}

type ShellProps = { data: Payload3; section: string; go: (id: string) => void }

const current = (id: string) =>
	(SECTIONS.find((s) => s.id === id) ?? SECTIONS[0]) as SectionDef

/** Keeps the active item of a horizontal strip in view without moving the page. */
function useKeepInView(active: string) {
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const strip = ref.current
		const el = strip?.querySelector<HTMLElement>(`[data-id="${active}"]`)
		if (!strip || !el) return
		const left = el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2
		strip.scrollTo({ left, behavior: "smooth" })
	}, [active])
	return ref
}

function Tabs({ data, section, go }: ShellProps) {
	const S = current(section)
	const strip = useKeepInView(section)
	return (
		<>
			<div className="sticky top-16 z-30 border-b border-white/10 bg-gray-900/95 backdrop-blur">
				<div
					ref={strip}
					className="t3-noscroll mx-auto flex max-w-7xl gap-7 overflow-x-auto px-4 md:gap-9 md:px-8"
					role="tablist"
					aria-label="Your taste"
				>
					{SECTIONS.map((s) => {
						const on = s.id === section
						return (
							<button
								key={s.id}
								data-id={s.id}
								type="button"
								role="tab"
								aria-selected={on}
								onClick={() => go(s.id)}
								className={`shrink-0 border-b-2 pb-3 pt-4 text-base font-bold transition md:text-lg ${on ? "border-amber-400 text-white" : "border-transparent text-gray-400 hover:text-gray-200"}`}
							>
								{s.label}
							</button>
						)
					})}
				</div>
			</div>
			<div key={S.id} className="pb-44 pt-10 md:pt-14">
				<S.View data={data} />
			</div>
		</>
	)
}

function Rail({ data, section, go }: ShellProps) {
	const S = current(section)
	const titles = sectionTitles(data)
	const strip = useKeepInView(section)
	return (
		<>
			{/* Mobile: the rail folds into a scrollable strip under the header. */}
			<div className="sticky top-16 z-30 border-b border-white/10 bg-gray-900/95 backdrop-blur lg:hidden">
				<div
					ref={strip}
					className="t3-noscroll flex gap-2 overflow-x-auto px-4 py-2.5"
				>
					{SECTIONS.map((s) => {
						const on = s.id === section
						const t = titles[s.id]
						return (
							<button
								key={s.id}
								data-id={s.id}
								type="button"
								onClick={() => go(s.id)}
								aria-current={on ? "page" : undefined}
								className={`flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-sm font-semibold transition ${on ? "border-amber-500/70 bg-amber-500/15 text-white" : "border-white/10 text-gray-300"}`}
							>
								{t && (
									<img
										src={poster(t, "w185")}
										alt=""
										className="h-7 w-7 rounded-full object-cover"
									/>
								)}
								{s.label}
							</button>
						)
					})}
				</div>
			</div>
			<div className="mx-auto grid max-w-[90rem] lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6 lg:px-6">
				<nav
					className="sticky top-24 hidden self-start pt-10 lg:block"
					aria-label="Your taste"
				>
					<p className="mb-5 px-3 text-2xl font-bold">Your taste</p>
					<ul className="space-y-1">
						{SECTIONS.map((s) => {
							const on = s.id === section
							const t = titles[s.id]
							return (
								<li key={s.id}>
									<button
										type="button"
										onClick={() => go(s.id)}
										aria-current={on ? "page" : undefined}
										className={`grid w-full grid-cols-[2.5rem_1fr] items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-left transition ${on ? "border-amber-400 bg-white/[0.06]" : "border-transparent hover:bg-white/[0.03]"}`}
									>
										{t ? (
											<img
												src={poster(t, "w185")}
												alt=""
												className={`aspect-[2/3] w-10 rounded object-cover transition ${on ? "" : "opacity-60"}`}
											/>
										) : (
											<span />
										)}
										<span className="min-w-0">
											<span
												className={`block font-semibold ${on ? "text-white" : "text-gray-300"}`}
											>
												{s.label}
											</span>
											<span className="line-clamp-2 block text-xs leading-snug text-gray-500">
												{s.teaser(data)}
											</span>
										</span>
									</button>
								</li>
							)
						})}
					</ul>
				</nav>
				<div key={S.id} className="min-w-0 pb-44 pt-10 lg:pt-12">
					<S.View data={data} />
				</div>
			</div>
		</>
	)
}

function Chapters({ data, go }: { data: Payload3; go: (id: string) => void }) {
	const [active, setActive] = useState(SECTIONS[0].id)
	const [progress, setProgress] = useState(0)
	const wrap = useRef<HTMLDivElement>(null)
	const strip = useKeepInView(active)

	useEffect(() => {
		const els = SECTIONS.map((s) =>
			document.getElementById(`t3-${s.id}`),
		).filter((e): e is HTMLElement => !!e)
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries)
					if (e.isIntersecting) setActive(e.target.id.replace("t3-", ""))
			},
			{ rootMargin: "-35% 0px -60% 0px" },
		)
		for (const el of els) io.observe(el)
		const onScroll = () => {
			const el = wrap.current
			if (!el) return
			const top = el.getBoundingClientRect().top + window.scrollY
			const span = el.offsetHeight - window.innerHeight
			setProgress(
				Math.max(0, Math.min(1, (window.scrollY - top + 200) / (span || 1))),
			)
		}
		onScroll()
		window.addEventListener("scroll", onScroll, { passive: true })
		return () => {
			io.disconnect()
			window.removeEventListener("scroll", onScroll)
		}
	}, [])

	const idx = SECTIONS.findIndex((s) => s.id === active)
	return (
		<div ref={wrap}>
			<div className="sticky top-16 z-30 bg-gray-900/95 backdrop-blur">
				<div
					ref={strip}
					className="t3-noscroll mx-auto flex max-w-7xl items-baseline gap-6 overflow-x-auto px-4 pb-3 pt-3.5 md:gap-8 md:px-8"
				>
					{SECTIONS.map((s, i) => {
						const on = s.id === active
						return (
							<button
								key={s.id}
								data-id={s.id}
								type="button"
								onClick={() => go(s.id)}
								aria-current={on ? "true" : undefined}
								className={`flex shrink-0 items-baseline gap-2 transition ${on ? "text-white" : i < idx ? "text-gray-400" : "text-gray-500 hover:text-gray-300"}`}
							>
								<span className="text-xs tabular-nums text-gray-500">
									{i + 1}
								</span>
								<span
									className={`font-extrabold ${on ? "text-xl md:text-2xl" : "text-base md:text-lg"}`}
									style={CONDENSED}
								>
									{s.label}
								</span>
							</button>
						)
					})}
				</div>
				<div className="h-0.5 bg-white/10">
					<div
						className="h-full bg-amber-400 transition-[width] duration-150"
						style={{ width: `${progress * 100}%` }}
					/>
				</div>
			</div>
			{SECTIONS.map((s, i) => (
				<section
					key={s.id}
					id={`t3-${s.id}`}
					className={`scroll-mt-28 ${i ? "border-t border-white/10" : ""} pb-20 pt-14 md:pb-28 md:pt-20`}
				>
					<s.View data={data} />
				</section>
			))}
			<div className="h-40" />
		</div>
	)
}
