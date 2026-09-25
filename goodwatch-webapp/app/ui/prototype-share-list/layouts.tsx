// PROTOTYPE - throwaway. Editor layouts that make the card the centerpiece. Each keeps every
// control (titles, search, design, theme, title, signature, share) but hides or shrinks them
// differently. Switch with ?variant=<key>.
import {
	ArrowUpOnSquareIcon,
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	Cog6ToothIcon,
	EllipsisHorizontalIcon,
	ListBulletIcon,
	MagnifyingGlassIcon,
	PaintBrushIcon,
	PencilSquareIcon,
	PlusIcon,
	Squares2X2Icon,
	XMarkIcon,
} from "@heroicons/react/24/outline"
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"
import { DESIGNS } from "./designs"
import { THEMES, type ThemeKey } from "./model"
import {
	DesignNav,
	DesignStrip,
	Dialogs,
	DragGhost,
	type Ed,
	label,
	NameInput,
	Picks,
	Preview,
	PreviewStyles,
	PromptChips,
	RankList,
	Scaled,
	ShareButtons,
	Swatches,
	TitleInput,
} from "./editor-kit"

// Full viewport below the site header, leaving room for the mobile bottom nav.
const SCREEN = "h-[calc(100dvh-4rem)] max-lg:h-[calc(100dvh-8rem)]"

function Shell({ ed, children, className = "" }: { ed: Ed; children: ReactNode; className?: string }) {
	return (
		<div className={`relative overflow-hidden bg-neutral-950 text-white ${SCREEN} ${className}`}>
			<PreviewStyles ed={ed} />
			<div
				className="pointer-events-none absolute inset-0 opacity-40 transition-colors duration-700"
				style={{ backgroundImage: `radial-gradient(ellipse at 50% 35%, ${ed.t.accent}33 0%, transparent 60%)` }}
			/>
			{children}
			<DragGhost ed={ed} />
			<Dialogs ed={ed} />
		</div>
	)
}

const IconButton = ({ onClick, label: text, active, children, className = "" }: { onClick: () => void; label: string; active?: boolean; children: ReactNode; className?: string }) => (
	<button
		type="button"
		onClick={onClick}
		aria-label={text}
		title={text}
		aria-pressed={active}
		className={`flex items-center justify-center rounded-full transition ${active ? "bg-white text-black" : "bg-white/10 hover:bg-white/20"} ${className}`}
	>
		{children}
	</button>
)

const SideArrows = ({ ed }: { ed: Ed }) => (
	<>
		<IconButton onClick={() => ed.step(-1)} label="Previous design" className="absolute top-1/2 left-3 z-10 size-11 -translate-y-1/2 backdrop-blur sm:left-6">
			<ChevronLeftIcon className="size-5" />
		</IconButton>
		<IconButton onClick={() => ed.step(1)} label="Next design" className="absolute top-1/2 right-3 z-10 size-11 -translate-y-1/2 backdrop-blur sm:right-6">
			<ChevronRightIcon className="size-5" />
		</IconButton>
	</>
)

// Click-outside popover anchored to its trigger.
function Popover({ open, onClose, children, className = "" }: { open: boolean; onClose: () => void; children: ReactNode; className?: string }) {
	if (!open) return null
	return (
		<>
			<div className="fixed inset-0 z-20" onClick={onClose} />
			<div className={`absolute z-30 flex flex-col gap-4 rounded-3xl bg-neutral-900/95 p-4 shadow-2xl ring-1 ring-white/10 backdrop-blur ${className}`}>{children}</div>
		</>
	)
}

function StyleControls({ ed }: { ed: Ed }) {
	return (
		<>
			<div className="flex flex-col gap-2">
				<div className={label}>Title</div>
				<TitleInput ed={ed} className="rounded-2xl bg-white/10 px-4 py-2.5 text-lg" />
				<PromptChips ed={ed} wrap />
			</div>
			<div className="flex flex-col gap-2">
				<div className={label}>Signed</div>
				<NameInput ed={ed} />
			</div>
			<div className="flex flex-col gap-2">
				<div className={label}>Colors</div>
				<Swatches ed={ed} />
			</div>
		</>
	)
}

// ------------------------------------------------------------------ 1. Stage
// The card fills the screen. A dock at the bottom opens one tool at a time; the open tool
// pushes the card up (it shrinks to fit) instead of covering it.

type Tool = "titles" | "add" | "design" | "style" | "share"
const TOOLS: [Tool, string, typeof ListBulletIcon][] = [
	["titles", "Titles", ListBulletIcon],
	["add", "Add", PlusIcon],
	["design", "Design", Squares2X2Icon],
	["style", "Style", PaintBrushIcon],
	["share", "Share", ArrowUpOnSquareIcon],
]

function Stage({ ed }: { ed: Ed }) {
	const [tool, setTool] = useState<Tool | null>(null)
	return (
		<Shell ed={ed} className="flex flex-col">
			<div className="relative min-h-0 flex-1 px-16 pt-5 pb-3 sm:px-24">
				<Preview ed={ed} fill />
				<SideArrows ed={ed} />
			</div>
			<div className="relative flex flex-col items-center gap-3 px-3 pb-4">
				{tool && (
					<div className="flex max-h-[42vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-3xl bg-neutral-900/95 p-4 shadow-2xl ring-1 ring-white/10">
						{tool === "titles" && <RankList ed={ed} variant="compact" />}
						{tool === "add" && <Picks ed={ed} layout="row" autoFocus limit={30} />}
						{tool === "design" && <DesignStrip ed={ed} h={120} />}
						{tool === "style" && <StyleControls ed={ed} />}
						{tool === "share" && <ShareButtons ed={ed} />}
					</div>
				)}
				<nav className="flex gap-1 rounded-full bg-neutral-900/90 p-1.5 shadow-2xl ring-1 ring-white/10 backdrop-blur" aria-label="Tools">
					{TOOLS.map(([key, text, Icon]) => (
						<button
							key={key}
							type="button"
							aria-pressed={tool === key}
							onClick={() => setTool(tool === key ? null : key)}
							className={`flex flex-col items-center gap-0.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold transition sm:flex-row sm:gap-1.5 sm:px-4 sm:py-2 sm:text-sm ${tool === key ? "bg-white text-black" : "text-neutral-300 hover:bg-white/10"}`}
						>
							<Icon className="size-5" />
							{text}
						</button>
					))}
				</nav>
			</div>
		</Shell>
	)
}

// ------------------------------------------------------------------ 2. Rail
// The card in the middle, the ranking as a slim strip of posters at the edge. The plus button
// slides out a drawer with search and picks; a gear holds the rest.

function Rail({ ed }: { ed: Ed }) {
	const [drawer, setDrawer] = useState(false)
	const [menu, setMenu] = useState(false)
	return (
		<Shell ed={ed} className="flex flex-col lg:flex-row">
			<div className="flex min-h-0 min-w-0 flex-1 flex-col">
				<div className="relative flex items-center justify-between gap-3 px-4 py-3">
					<DesignNav ed={ed} />
					<div className="relative flex items-center gap-2">
						<IconButton onClick={() => setMenu(!menu)} label="Settings" active={menu} className="size-10">
							<Cog6ToothIcon className="size-5" />
						</IconButton>
						<Popover open={menu} onClose={() => setMenu(false)} className="top-12 right-0 w-[min(360px,90vw)]">
							<StyleControls ed={ed} />
						</Popover>
						<ShareButtons ed={ed} compact />
					</div>
				</div>
				<div className="min-h-0 flex-1 px-4 pb-4">
					<Preview ed={ed} fill />
				</div>
			</div>
			<aside className="relative flex shrink-0 items-center gap-3 border-white/10 bg-neutral-950/80 p-3 max-lg:border-t lg:w-24 lg:flex-col lg:border-l lg:py-5">
				<div className={`${label} max-lg:hidden`}>Top {ed.design.max}</div>
				<div className="min-w-0 flex-1 max-lg:overflow-x-auto lg:overflow-y-auto">
					<div className="max-lg:hidden">
						<RankList ed={ed} variant="rail" />
					</div>
					<div className="lg:hidden">
						<RankList ed={ed} variant="rail" axis="x" />
					</div>
				</div>
				<IconButton onClick={() => setDrawer(!drawer)} label="Add titles" active={drawer} className="size-12 shrink-0">
					{drawer ? <XMarkIcon className="size-6" /> : <PlusIcon className="size-6" />}
				</IconButton>
			</aside>
			<div
				className={`absolute inset-y-0 z-20 flex w-[min(400px,100%)] flex-col gap-3 overflow-y-auto bg-neutral-900/97 p-4 shadow-2xl ring-1 ring-white/10 transition-transform duration-300 max-lg:bottom-[76px] lg:right-24 ${drawer ? "translate-x-0" : "pointer-events-none translate-x-[110%] lg:translate-x-[130%]"} right-0`}
				aria-hidden={!drawer}
			>
				<div className="flex items-center justify-between">
					<div className={label}>Drag onto the card or the strip</div>
					<button type="button" onClick={() => setDrawer(false)} aria-label="Close" className="rounded-full p-1 hover:bg-white/10">
						<XMarkIcon className="size-5" />
					</button>
				</div>
				<Picks ed={ed} />
			</div>
		</Shell>
	)
}

// ------------------------------------------------------------------ 3. Shelf
// No list at all. The card is the list: drag posters on it to reorder, drag from the shelf
// below onto a poster to replace it. A thin top bar holds design, colors, and share.

function Shelf({ ed }: { ed: Ed }) {
	return (
		<Shell ed={ed} className="flex flex-col">
			<div className="flex items-center justify-between gap-3 px-4 py-3">
				<DesignNav ed={ed} />
				<div className="max-sm:hidden">
					<Swatches ed={ed} size="size-6" />
				</div>
				<ShareButtons ed={ed} compact />
			</div>
			<div className="min-h-0 flex-1 px-4 pb-3">
				<Preview ed={ed} fill />
			</div>
			<div className="rounded-t-3xl bg-neutral-900/95 px-4 pt-3 pb-4 shadow-[0_-20px_60px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
				<div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
					<span>Drag a poster onto the card · drag posters on the card to reorder</span>
					<span className="sm:hidden">
						<Swatches ed={ed} size="size-5" />
					</span>
				</div>
				<Picks ed={ed} layout="row" limit={30} />
			</div>
		</Shell>
	)
}

// ------------------------------------------------------------------ 4. Carousel
// Design-first. Every design sits side by side at full size with your list; swipe to pick one.
// Editing the titles is one button away, in a sheet.

function Carousel({ ed }: { ed: Ed }) {
	const scroller = useRef<HTMLDivElement>(null)
	const [sheet, setSheet] = useState(false)
	const fromScroll = useRef(false)
	// Keep the active design centered when it changes from outside the scroller.
	useEffect(() => {
		if (fromScroll.current) {
			fromScroll.current = false
			return
		}
		const el = scroller.current?.children[ed.di] as HTMLElement | undefined
		el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" })
	}, [ed.di])
	const onScroll = () => {
		const box = scroller.current
		if (!box) return
		clearTimeout((onScroll as unknown as { t?: number }).t)
		;(onScroll as unknown as { t?: number }).t = window.setTimeout(() => {
			const mid = box.scrollLeft + box.clientWidth / 2
			const kids = [...box.children] as HTMLElement[]
			const i = kids.reduce((best, k, j) => (Math.abs(k.offsetLeft + k.offsetWidth / 2 - mid) < Math.abs(kids[best].offsetLeft + kids[best].offsetWidth / 2 - mid) ? j : best), 0)
			if (i !== ed.di) {
				fromScroll.current = true
				ed.setDesign(DESIGNS[i].key)
			}
		}, 120)
	}
	return (
		<Shell ed={ed} className="flex flex-col">
			<div ref={scroller} onScroll={onScroll} className="flex min-h-0 flex-1 snap-x snap-mandatory gap-6 overflow-x-auto px-[12vw] pt-6 pb-2 [scrollbar-width:none]">
				{DESIGNS.map((d, i) => (
					<div key={d.key} className={`flex h-full w-[min(76vw,640px)] shrink-0 snap-center flex-col gap-2 transition duration-300 ${i === ed.di ? "" : "scale-[0.92] opacity-40"}`}>
						<div className="text-center text-sm font-bold">
							{d.name} <span className="font-normal text-neutral-500">· {d.format}</span>
						</div>
						<div className="min-h-0 flex-1" onClick={() => i !== ed.di && ed.setDesign(d.key)}>
							{i === ed.di ? <Preview ed={ed} fill /> : <Scaled design={d} list={ed.list} date={ed.date} fill className="pointer-events-none rounded-[18px]" />}
						</div>
					</div>
				))}
			</div>
			<div className="flex flex-wrap items-center justify-center gap-3 px-4 py-4">
				<button type="button" onClick={() => setSheet(true)} className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/15">
					<PencilSquareIcon className="size-5" /> Edit titles
				</button>
				<Swatches ed={ed} size="size-7" />
				<ShareButtons ed={ed} compact />
			</div>
			{sheet && (
				<div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSheet(false)}>
					<div className="flex max-h-[80%] w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-neutral-900 p-5 ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
						<div className="flex items-center justify-between">
							<TitleInput ed={ed} className="text-2xl" />
							<button type="button" onClick={() => setSheet(false)} className="rounded-full bg-white px-4 py-1.5 text-sm font-black text-black">
								Done
							</button>
						</div>
						<div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
							<RankList ed={ed} variant="compact" />
							<Picks ed={ed} limit={18} />
						</div>
					</div>
				</div>
			)}
		</Shell>
	)
}

// ------------------------------------------------------------------ 5. Command
// The card and one bar. "Add a title" opens search right above the bar; everything else lives
// behind the ⋯ menu.

function Command({ ed }: { ed: Ed }) {
	const [add, setAdd] = useState(false)
	const [menu, setMenu] = useState(false)
	return (
		<Shell ed={ed} className="flex flex-col">
			<div className="min-h-0 flex-1 px-4 pt-6 pb-3">
				<Preview ed={ed} fill />
			</div>
			<div className="relative mx-auto flex w-full max-w-2xl flex-col gap-2 px-3 pb-4">
				{add && (
					<div className="flex max-h-[40vh] flex-col overflow-y-auto rounded-3xl bg-neutral-900/95 p-4 shadow-2xl ring-1 ring-white/10">
						<Picks ed={ed} autoFocus limit={18} />
					</div>
				)}
				<div className="flex items-center gap-2 rounded-full bg-neutral-900/95 p-1.5 shadow-2xl ring-1 ring-white/10 backdrop-blur">
					<button type="button" onClick={() => setAdd(!add)} className={`flex min-w-0 flex-1 items-center gap-2 rounded-full px-4 py-2 text-left text-sm ${add ? "bg-white text-black" : "text-neutral-400 hover:bg-white/5"}`}>
						{add ? <XMarkIcon className="size-5 shrink-0" /> : <MagnifyingGlassIcon className="size-5 shrink-0" />}
						<span className="truncate">{add ? "Close" : "Add a title…"}</span>
					</button>
					<DesignNav ed={ed} className="max-sm:hidden" />
					<div className="relative">
						<IconButton onClick={() => setMenu(!menu)} label="More" active={menu} className="size-10">
							<EllipsisHorizontalIcon className="size-6" />
						</IconButton>
						<Popover open={menu} onClose={() => setMenu(false)} className="right-0 bottom-14 max-h-[60vh] w-[min(380px,90vw)] overflow-y-auto">
							<div className="sm:hidden">
								<DesignNav ed={ed} />
							</div>
							<div className="flex flex-col gap-2">
								<div className={label}>Ranking</div>
								<RankList ed={ed} variant="compact" />
							</div>
							<StyleControls ed={ed} />
						</Popover>
					</div>
					<ShareButtons ed={ed} compact />
				</div>
			</div>
		</Shell>
	)
}

// ------------------------------------------------------------------ 6. Flip
// Only the card. "Edit" flips it over; the controls live on its back, in the same footprint.

function useFit(ratio: number) {
	const ref = useRef<HTMLDivElement>(null)
	const [size, setSize] = useState({ w: 0, h: 0 })
	useLayoutEffect(() => {
		const el = ref.current
		if (!el) return
		const ro = new ResizeObserver(([e]) => {
			const { width, height } = e.contentRect
			const w = Math.min(width, height * ratio)
			setSize({ w, h: w / ratio })
		})
		ro.observe(el)
		return () => ro.disconnect()
	}, [ratio])
	return { ref, size }
}

// ← [Design ▾] →. The name opens a dropdown with a live preview of every design.
function DesignPicker({ ed, onPreview }: { ed: Ed; onPreview?: (key: string | null) => void }) {
	const [open, setOpen] = useState(false)
	const close = () => {
		setOpen(false)
		onPreview?.(null)
	}
	return (
		<div className="relative">
			<div className="flex items-center gap-1 rounded-full bg-white/10 p-1">
				<button type="button" onClick={() => ed.step(-1)} aria-label="Previous design" className="rounded-full p-1.5 transition hover:bg-white/15">
					<ChevronLeftIcon className="size-4" />
				</button>
				<button
					type="button"
					onClick={() => (open ? close() : setOpen(true))}
					aria-expanded={open}
					aria-haspopup="dialog"
					className={`flex w-32 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 sm:w-40 text-sm font-bold transition ${open ? "bg-white text-black" : "hover:bg-white/15"}`}
				>
					<span className="truncate">{ed.design.name}</span>
					<ChevronDownIcon className="size-4 shrink-0 transition-transform" style={{ transform: open ? "rotate(180deg)" : undefined }} />
				</button>
				<button type="button" onClick={() => ed.step(1)} aria-label="Next design" className="rounded-full p-1.5 transition hover:bg-white/15">
					<ChevronRightIcon className="size-4" />
				</button>
			</div>
			<Popover open={open} onClose={close} className="fixed! top-[8.5rem] left-4 max-h-[calc(100vh-10rem)] w-[min(340px,calc(100vw-2rem))] overflow-y-auto">
				<div className={label}>Designs</div>
				<div className="grid grid-cols-2 gap-2" onMouseLeave={() => onPreview?.(null)}>
					{DESIGNS.map((d) => {
						const active = d.key === ed.design.key
						return (
							<button
								key={d.key}
								type="button"
								onMouseEnter={() => onPreview?.(d.key)}
								onFocus={() => onPreview?.(d.key)}
								onClick={() => {
									ed.setDesign(d.key)
									close()
								}}
								aria-pressed={active}
								className={`group flex flex-col items-center gap-1.5 rounded-2xl p-2 transition ${active ? "bg-white/15 ring-2" : "hover:-translate-y-0.5 hover:bg-white/10"}`}
								style={{ ["--tw-ring-color" as string]: ed.t.accent }}
							>
								<div className="pointer-events-none flex h-40 w-full items-center">
									<Scaled design={d} list={ed.list} date={ed.date} maxH={152} className="rounded-md shadow-lg shadow-black/50 transition group-hover:shadow-black" />
								</div>
								<span className={`text-xs font-bold ${active ? "text-white" : "text-neutral-400 group-hover:text-white"}`}>{d.name}</span>
								<span className="-mt-1 text-[10px] text-neutral-500">{d.format}</span>
							</button>
						)
					})}
				</div>
			</Popover>
		</div>
	)
}

// Color dropdown. Hovering a color previews it on the card without saving it.
function ThemePicker({ ed, onPreview }: { ed: Ed; onPreview: (k: ThemeKey | null) => void }) {
	const [open, setOpen] = useState(false)
	const close = () => {
		setOpen(false)
		onPreview(null)
	}
	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => (open ? close() : setOpen(true))}
				aria-expanded={open}
				aria-haspopup="listbox"
				className={`flex w-32 items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 sm:w-36 text-sm font-bold transition ${open ? "bg-white text-black" : "bg-white/10 hover:bg-white/15"}`}
			>
				<span className="size-6 rounded-full" style={{ backgroundImage: `linear-gradient(135deg, ${ed.t.accent}, ${ed.t.accent2})` }} />
				<span className="flex-1 truncate text-left">{ed.t.label}</span>
				<ChevronDownIcon className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
			</button>
			<Popover open={open} onClose={close} className="top-12 left-1/2 w-52 -translate-x-1/2 gap-0.5! p-2!">
				<div role="listbox" aria-label="Colors" className="flex flex-col gap-0.5" onMouseLeave={() => onPreview(null)}>
					{(Object.keys(THEMES) as ThemeKey[]).map((k) => (
						<button
							key={k}
							type="button"
							role="option"
							aria-selected={ed.list.theme === k}
							onMouseEnter={() => onPreview(k)}
							onFocus={() => onPreview(k)}
							onClick={() => {
								ed.list.set({ theme: k })
								close()
							}}
							className={`flex items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm font-semibold transition hover:bg-white/10 ${ed.list.theme === k ? "bg-white/10" : ""}`}
						>
							<span className="size-6 rounded-full" style={{ backgroundImage: `linear-gradient(135deg, ${THEMES[k].accent}, ${THEMES[k].accent2})` }} />
							<span className="flex-1">{THEMES[k].label}</span>
							{ed.list.theme === k && <span className="text-xs text-neutral-400">✓</span>}
						</button>
					))}
				</div>
			</Popover>
		</div>
	)
}

function Flip({ ed }: { ed: Ed }) {
	const [back, setBack] = useState(false)
	const [preview, setPreview] = useState<ThemeKey | null>(null)
	const [previewDesign, setPreviewDesign] = useState<string | null>(null)
	// While hovering a color or a design, the card shows it; nothing is saved until a click.
	const themed: Ed = preview ? { ...ed, list: { ...ed.list, theme: preview }, t: THEMES[preview] } : ed
	const view: Ed = previewDesign ? { ...themed, design: DESIGNS.find((d) => d.key === previewDesign) ?? ed.design } : themed
	const { ref, size } = useFit(Math.max(view.design.w / view.design.h, 0.62))
	return (
		<Shell ed={view} className="flex flex-col">
			<div className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-3 px-4 pt-4">
				<button type="button" onClick={() => setBack(!back)} className="order-1 flex w-28 items-center justify-center gap-2 rounded-full bg-white py-2.5 font-black text-black transition hover:bg-neutral-200">
					{back ? (
						"Done"
					) : (
						<>
							<PencilSquareIcon className="size-5" /> Edit
						</>
					)}
				</button>
				<div className="order-3 flex w-full items-center justify-center gap-3 lg:order-2 lg:w-auto lg:flex-1">
					<DesignPicker ed={ed} onPreview={setPreviewDesign} />
					<ThemePicker ed={ed} onPreview={setPreview} />
				</div>
				<div className="order-2 ml-auto flex items-center gap-3 lg:order-3 lg:ml-0">
					<span className={`text-xs whitespace-nowrap text-neutral-500 transition-opacity max-sm:hidden ${ed.saved ? "opacity-100" : "opacity-0"}`} aria-live="polite">
						✓ Saved
					</span>
					<ShareButtons ed={ed} compact />
				</div>
			</div>
			<div ref={ref} className="relative flex min-h-0 flex-1 items-center justify-center px-4 pt-4 pb-4 [perspective:2200px]">
				<div className="relative transition-transform duration-700 [transform-style:preserve-3d]" style={{ width: size.w, height: size.h, transform: back ? "rotateY(180deg)" : "none" }}>
					<div className="absolute inset-0 [backface-visibility:hidden]">
						<Preview ed={view} fill />
					</div>
					<div className="absolute inset-0 flex flex-col gap-5 overflow-y-auto rounded-[18px] bg-neutral-900 p-4 ring-1 ring-white/10 [backface-visibility:hidden] [transform:rotateY(180deg)]">
						<div className="flex shrink-0 flex-col gap-2">
							<div className={label}>Title</div>
							<TitleInput ed={ed} className="rounded-2xl bg-white/10 px-4 py-2.5 text-lg" />
							<PromptChips ed={ed} />
						</div>
						<div className="flex shrink-0 flex-col gap-2">
							<div className={label}>Signed</div>
							<NameInput ed={ed} />
						</div>
						<div className="flex shrink-0 flex-col gap-2">
							<div className={label}>Ranking</div>
							<RankList ed={ed} variant="compact" />
						</div>
						<div className="flex min-h-72 flex-1 flex-col gap-2">
							<div className={label}>Add titles</div>
							<Picks ed={ed} limit={48} fill />
						</div>
					</div>
				</div>
			</div>
		</Shell>
	)
}

// ------------------------------------------------------------------ 7. Current
// The previous editor, for comparison.

function Current({ ed }: { ed: Ed }) {
	return (
		<div className="min-h-screen bg-neutral-950 text-white">
			<PreviewStyles ed={ed} />
			<div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-10 px-4 pt-8 pb-32 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:px-8">
				<div className="order-2 flex min-w-0 flex-col gap-8 lg:order-1">
					<div className="flex flex-col gap-3">
						<div className={label}>Your list</div>
						<TitleInput ed={ed} className="border-b-2 border-neutral-800 px-0 pb-2 text-3xl focus:border-white sm:text-4xl" />
						<PromptChips ed={ed} />
					</div>
					<RankList ed={ed} />
					<Picks ed={ed} />
					<div className="flex flex-wrap items-center gap-4">
						<div className="min-w-48 flex-1">
							<NameInput ed={ed} />
						</div>
						<Swatches ed={ed} />
					</div>
				</div>
				<div className="order-1 min-w-0 lg:order-2">
					<div className="flex flex-col items-center gap-4 lg:sticky lg:top-20">
						<Preview ed={ed} maxH={680} />
						<DesignNav ed={ed} />
						<div className="w-full max-w-md">
							<ShareButtons ed={ed} />
						</div>
						<div className="w-full">
							<DesignStrip ed={ed} />
						</div>
					</div>
				</div>
			</div>
			<DragGhost ed={ed} />
			<Dialogs ed={ed} />
		</div>
	)
}

export const LAYOUTS = {
	flip: { name: "Flip · controls on the back", View: Flip },
	stage: { name: "Stage · dock", View: Stage },
	rail: { name: "Rail · poster strip", View: Rail },
	shelf: { name: "Shelf · card is the list", View: Shelf },
	carousel: { name: "Carousel · design first", View: Carousel },
	command: { name: "Command · one bar", View: Command },
	current: { name: "Current · for comparison", View: Current },
} as const
export type LayoutKey = keyof typeof LAYOUTS
