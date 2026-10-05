// PROTOTYPE - throwaway. #192: five ways to move between Home, Watch next, Discover and Search, Taste and
// Explorer. Each variant draws the phone's top bar, the phone's bottom surface (merged with the page's own
// controls, per the `slab` decision) and the desktop header.
//   tabs     five fixed tabs; the settled slab (strip stays, tab row folds away while scrolling down)
//   search   four tabs around a central search key; Discover and Search are one page
//   merge    the page's controls take the bar; tonight's poster and one handle stay; swipe up restores the nav
//   hub      remote-style dock: Watch next, one hub key that opens every destination, search
//   command  no tabs: an omnibox ("Search or go to…") plus tonight's poster; ⌘K palette on desktop
import { ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon, Squares2X2Icon } from "@heroicons/react/24/solid"
import { type ReactNode, useRef, useState } from "react"
import { Account, GMark, PAGE_ICON, TonightThumb, Wordmark } from "./bits"
import { DiscStrip, ExplorerControls, TasteTabs, WnDock, WnStrip } from "./controls"
import { PAGES, type PageKey, type VariantKey, pageLabel, useShell } from "./model"

/** The page's phone controls in the slab position, or nothing for pages that keep their controls in place. */
function PageStrip({ compact }: { compact?: boolean }) {
	const s = useShell()
	if (s.page === "watch") return <WnStrip compact={compact} />
	if (s.page === "discover") return <DiscStrip compact={compact} />
	return null
}
const hasStrip = (p: PageKey) => p === "watch" || p === "discover"

function Tab({ k, label }: { k: PageKey; label?: string }) {
	const s = useShell()
	const Icon = PAGE_ICON[k]
	const on = s.page === k
	return (
		<button type="button" className={`rn-tab ${on ? "is-on" : ""}`} onClick={() => s.go(k)} aria-current={on ? "page" : undefined}>
			<Icon className="rn-i22" />
			<span>{label ?? pageLabel(k)}</span>
		</button>
	)
}

function Fold({ open, children }: { open: boolean; children: ReactNode }) {
	return (
		<div className={`rn-fold ${open ? "is-open" : ""}`}>
			<div>{children}</div>
		</div>
	)
}

function TopBar({ children }: { children?: ReactNode }) {
	const s = useShell()
	return (
		<div className="rn-top">
			<Wordmark small />
			<span className="rn-top-title">{s.page === "home" ? "GoodWatch" : pageLabel(s.page)}</span>
			<span className="rn-grow" />
			{children}
		</div>
	)
}

function HeaderLinks({ keys = PAGES.map((p) => p.k) }: { keys?: PageKey[] }) {
	const s = useShell()
	return (
		<nav className="rn-hlinks">
			{keys.map((k) => (
				<button type="button" key={k} className={s.page === k ? "is-on" : ""} onClick={() => s.go(k)}>
					{pageLabel(k)}
					{k === "watch" && s.who === "member" && <span className="rn-badge">11</span>}
				</button>
			))}
		</nav>
	)
}

function SearchField({ wide, label = "Search titles, people, moods", kbd }: { wide?: boolean; label?: string; kbd?: string }) {
	const s = useShell()
	return (
		<button type="button" className={`rn-hsearch ${wide ? "is-wide" : ""}`} onClick={kbd ? () => s.setSheet("cmd") : s.openSearch}>
			<MagnifyingGlassIcon className="rn-i18" />
			<span>{s.searching && s.q ? s.q : label}</span>
			{kbd && <kbd>{kbd}</kbd>}
		</button>
	)
}

/** Desktop sub-row for Taste's tabs, under the header (every variant but `merge`, which puts them in the header). */
function TasteSubrow() {
	const s = useShell()
	if (s.page !== "taste") return null
	return (
		<div className="rn-subrow">
			<TasteTabs where="header" />
		</div>
	)
}

// ------------------------------------------------------------------ A. tabs

const Tabs = {
	Top: () => {
		const s = useShell()
		return (
			<TopBar>
				<button type="button" className="rn-iconbtn" onClick={s.openSearch} aria-label="Search">
					<MagnifyingGlassIcon className="rn-i22" />
				</button>
				<Account who={s.who} compact />
			</TopBar>
		)
	},
	Bottom: () => {
		const s = useShell()
		const strip = hasStrip(s.page)
		const folded = strip && s.folded
		return (
			<div className="rn-bottom rn-slab">
				{strip && (
					<div className="rn-slab-strip">
						{folded && s.page !== "watch" && <TonightThumb label={false} className="is-inline" />}
						<PageStrip compact={folded} />
					</div>
				)}
				<Fold open={!folded}>
					<nav className="rn-tabs">
						{PAGES.map((p) => (
							<Tab key={p.k} k={p.k} />
						))}
					</nav>
				</Fold>
			</div>
		)
	},
	Header: () => {
		const s = useShell()
		return (
			<>
				<header className="rn-header">
					<Wordmark />
					<HeaderLinks />
					<span className="rn-grow" />
					<SearchField />
					<Account who={s.who} />
				</header>
				<TasteSubrow />
			</>
		)
	},
}

// ------------------------------------------------------------------ B. search in the middle

const Search = {
	Top: () => {
		const s = useShell()
		return (
			<TopBar>
				<Account who={s.who} compact />
			</TopBar>
		)
	},
	Bottom: () => {
		const s = useShell()
		const on = s.page === "discover"
		return (
			<div className="rn-bottom rn-slab">
				{hasStrip(s.page) && (
					<div className="rn-slab-strip">
						<PageStrip />
					</div>
				)}
				<nav className="rn-tabs is-center">
					<Tab k="home" />
					<Tab k="watch" />
					<button type="button" className={`rn-centerkey ${on ? "is-on" : ""}`} onClick={s.openSearch} aria-label="Search and discover">
						<span>
							<MagnifyingGlassIcon className="rn-i24" />
						</span>
						<small>Discover</small>
					</button>
					<Tab k="taste" />
					<Tab k="explorer" />
				</nav>
			</div>
		)
	},
	Header: () => {
		const s = useShell()
		return (
			<>
				<header className="rn-header is-sym">
					<Wordmark />
					<HeaderLinks keys={["home", "watch"]} />
					<SearchField wide label="Search or discover: titles, people, a mood" />
					<HeaderLinks keys={["taste", "explorer"]} />
					<Account who={s.who} />
				</header>
				<TasteSubrow />
			</>
		)
	},
}

// ------------------------------------------------------------------ C. the page takes the bar

function NavPanel() {
	const s = useShell()
	return (
		<div className="rn-navpanel">
			<button type="button" className="rn-hub-search" onClick={s.openSearch}>
				<MagnifyingGlassIcon className="rn-i20" /> Search titles, people, moods
			</button>
			<nav className="rn-tabs">
				{PAGES.map((p) => (
					<Tab key={p.k} k={p.k} />
				))}
			</nav>
			{s.who === "guest" && (
				<button type="button" className="rn-hub-cta is-slim" onClick={() => s.setSheet("signup")}>
					<b>Sign up</b> to keep your Wishlist and taste
				</button>
			)}
		</div>
	)
}

function MergeBottom() {
	const s = useShell()
	const open = s.sheet === "navpanel"
	const y0 = useRef<number | null>(null)
	const takes = s.page !== "home"
	const onDown = (e: React.PointerEvent) => {
		y0.current = e.clientY
	}
	const onUp = (e: React.PointerEvent) => {
		if (y0.current === null) return
		const dy = e.clientY - y0.current
		y0.current = null
		if (dy < -24) s.setSheet("navpanel")
		if (dy > 24 && open) s.setSheet(null)
	}
	const controls =
		s.page === "watch" ? <WnStrip compact /> : s.page === "discover" ? <DiscStrip compact /> : s.page === "taste" ? <TasteTabs where="bottom" /> : s.page === "explorer" ? <ExplorerControls where="bottom" /> : null
	return (
		<>
			{open && <button type="button" className="rn-scrim is-soft" aria-label="Close navigation" onClick={() => s.setSheet(null)} />}
			<div className={`rn-bottom rn-merge ${open ? "is-open" : ""}`} onPointerDown={onDown} onPointerUp={onUp}>
				<span className="rn-grip" aria-hidden />
				{(open || !takes) && (takes ? <NavPanel /> : (
					<nav className="rn-tabs">
						{PAGES.map((p) => (
							<Tab key={p.k} k={p.k} />
						))}
					</nav>
				))}
				{takes && (
					<div className="rn-merge-row">
						{s.page !== "watch" && <TonightThumb label={false} className="is-inline" />}
						<div className="rn-merge-controls">{controls}</div>
						<button type="button" className={`rn-handle ${open ? "is-open" : ""}`} onClick={() => s.setSheet(open ? null : "navpanel")} aria-label={open ? "Hide navigation" : "Show navigation"}>
							<GMark size={18} />
							{open ? <ChevronDownIcon className="rn-i14" /> : <ChevronUpIcon className="rn-i14" />}
						</button>
					</div>
				)}
			</div>
		</>
	)
}

function PageMenu() {
	const s = useShell()
	const [open, setOpen] = useState(false)
	const Icon = PAGE_ICON[s.page]
	return (
		<div className="rn-pagemenu" onMouseLeave={() => setOpen(false)}>
			<button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
				<Icon className="rn-i18" />
				{pageLabel(s.page)}
				<ChevronDownIcon className="rn-i16" />
			</button>
			{open && (
				<div className="rn-pagemenu-pop">
					{PAGES.map((p) => {
						const I = PAGE_ICON[p.k]
						return (
							<button
								type="button"
								key={p.k}
								className={s.page === p.k ? "is-on" : ""}
								onClick={() => {
									setOpen(false)
									s.go(p.k)
								}}
							>
								<I className="rn-i18" /> {p.label}
							</button>
						)
					})}
				</div>
			)}
		</div>
	)
}

const Merge = {
	Top: () => {
		const s = useShell()
		return (
			<TopBar>
				<button type="button" className="rn-iconbtn" onClick={s.openSearch} aria-label="Search">
					<MagnifyingGlassIcon className="rn-i22" />
				</button>
				<Account who={s.who} compact />
			</TopBar>
		)
	},
	Bottom: MergeBottom,
	Header: () => {
		const s = useShell()
		const center =
			s.page === "taste" ? <TasteTabs where="header" /> : s.page === "explorer" ? <ExplorerControls where="header" /> : s.page === "watch" && s.folded ? <WnDock /> : s.page === "discover" && s.folded ? <SearchField label="Search Discover" /> : <HeaderLinks />
		return (
			<header className={`rn-header is-merge ${s.page !== "home" ? "is-taken" : ""}`}>
				<Wordmark small />
				{s.page !== "home" && <PageMenu />}
				<div className="rn-hcenter">{center}</div>
				{s.page !== "watch" && <TonightThumb label={false} />}
				<button type="button" className="rn-iconbtn" onClick={s.openSearch} aria-label="Search">
					<MagnifyingGlassIcon className="rn-i20" />
				</button>
				<Account who={s.who} />
			</header>
		)
	},
}

// ------------------------------------------------------------------ D. hub

const Hub = {
	Top: () => {
		const s = useShell()
		return (
			<TopBar>
				<Account who={s.who} compact />
			</TopBar>
		)
	},
	Bottom: () => {
		const s = useShell()
		const Icon = PAGE_ICON[s.page]
		return (
			<div className="rn-bottom rn-slab is-hub">
				{hasStrip(s.page) && (
					<div className="rn-slab-strip">
						<PageStrip />
					</div>
				)}
				<div className="rn-hubdock">
					<TonightThumb />
					<button type="button" className={`rn-hubkey-main ${s.sheet === "hub" ? "is-open" : ""}`} onClick={() => s.setSheet(s.sheet === "hub" ? null : "hub")} aria-label="All of GoodWatch">
						<GMark size={24} />
						<small>
							<Icon className="rn-i12" /> {s.page === "watch" ? "Watch" : pageLabel(s.page)}
						</small>
					</button>
					<button type="button" className={`rn-dockbtn ${s.searching ? "is-on" : ""}`} onClick={s.openSearch}>
						<MagnifyingGlassIcon className="rn-i22" />
						<span>Search</span>
					</button>
				</div>
			</div>
		)
	},
	Header: () => {
		const s = useShell()
		return (
			<>
				<header className="rn-header">
					<Wordmark />
					<button type="button" className={`rn-browse ${s.sheet === "hub" ? "is-open" : ""}`} onClick={() => s.setSheet(s.sheet === "hub" ? null : "hub")}>
						<Squares2X2Icon className="rn-i18" /> {s.page === "home" ? "Browse" : pageLabel(s.page)}
						<ChevronDownIcon className="rn-i16" />
					</button>
					<span className="rn-grow" />
					<SearchField />
					<TonightThumb />
					<Account who={s.who} />
				</header>
				<TasteSubrow />
			</>
		)
	},
}

// ------------------------------------------------------------------ E. command

const Command = {
	Top: () => <TopBar />,
	Bottom: () => {
		const s = useShell()
		const Icon = PAGE_ICON[s.page]
		return (
			<div className="rn-bottom rn-slab is-omni">
				{hasStrip(s.page) && (
					<div className="rn-slab-strip">
						<PageStrip />
					</div>
				)}
				<div className="rn-omnirow">
					<TonightThumb label={false} />
					<button type="button" className="rn-omni" onClick={() => s.setSheet("cmd")}>
						<span className="rn-omni-here">
							<Icon className="rn-i14" /> {pageLabel(s.page)}
						</span>
						<MagnifyingGlassIcon className="rn-i18" />
						<span className="rn-omni-text">Search or go to…</span>
					</button>
					<Account who={s.who} compact />
				</div>
			</div>
		)
	},
	Header: () => {
		const s = useShell()
		return (
			<>
				<header className="rn-header is-cmd">
					<Wordmark />
					<span className="rn-crumb">{s.page === "home" ? "" : pageLabel(s.page)}</span>
					<span className="rn-grow" />
					<SearchField wide label="Search or go to…" kbd="⌘K" />
					<span className="rn-grow" />
					<TonightThumb />
					<Account who={s.who} />
				</header>
				<TasteSubrow />
			</>
		)
	},
}

export type NavVariant = { name: string; Top: () => ReactNode; Bottom: () => ReactNode; Header: () => ReactNode }
export const VARIANTS: Record<VariantKey, NavVariant> = {
	tabs: { name: "Five tabs", ...Tabs },
	search: { name: "Search in the middle", ...Search },
	merge: { name: "Page takes the bar", ...Merge },
	hub: { name: "Remote hub", ...Hub },
	command: { name: "Omnibox", ...Command },
}
