// PROTOTYPE - throwaway. #192: each page's own controls, in the two shapes the settled prototypes gave them:
// the phone strip (slab, #175/#176: Watch next's three buttons each open their own drawer) and the desktop row
// (Watch next's docked glass strip, Discover's `studio` row). Taste's tabs and Explorer's map controls too.
// The navigation variants decide where the phone strips sit.
import { AdjustmentsHorizontalIcon, ArrowsUpDownIcon, ChevronDownIcon, EyeSlashIcon, FingerPrintIcon, GlobeAltIcon, LockClosedIcon } from "@heroicons/react/24/solid"
import { ArrowUturnLeftIcon } from "@heroicons/react/24/outline"
import { Logos } from "./bits"
import { DISC_SORTS, MOODS, MY_SERVICES, type TasteTab, WN_SORTS, useShell } from "./model"

const moodText = (ms: string[]) => (!ms.length ? "Any mood" : ms.length === 1 ? (MOODS.find((m) => m.k === ms[0])?.name ?? "") : `${MOODS.find((m) => m.k === ms[0])?.name} +${ms.length - 1}`)

export function MoodDots({ ms, size = 14 }: { ms: string[]; size?: number }) {
	const shown = ms.length ? ms : ["funny", "romance", "crime", "worlds"]
	return (
		<span className="rn-dots">
			{shown.map((k) => (
				<i key={k} style={{ width: size, height: size, background: MOODS.find((m) => m.k === k)?.hue, opacity: ms.length ? 1 : 0.55 }} />
			))}
		</span>
	)
}

export const wnSortName = (k: string) => WN_SORTS.find((x) => x.k === k)?.name ?? k

export function WnStrip({ compact }: { compact?: boolean }) {
	const s = useShell()
	return (
		<div className={`rn-strip ${compact ? "is-compact" : ""}`}>
			<button type="button" className={`rn-seg is-wide ${s.wn.moods.length ? "is-on" : ""}`} onClick={() => s.setSheet("wn-moods")}>
				<MoodDots ms={s.wn.moods} />
				<span>{moodText(s.wn.moods)}</span>
			</button>
			<button type="button" className="rn-seg" onClick={() => s.setSheet("wn-services")}>
				{s.wn.everywhere ? <GlobeAltIcon className="rn-i16" /> : <Logos ids={MY_SERVICES} size={16} />}
				<span>{s.wn.everywhere ? "Everywhere" : "My services"}</span>
			</button>
			<button type="button" className="rn-seg" onClick={() => s.setSheet("wn-sort")}>
				<ArrowsUpDownIcon className="rn-i16 rn-amber" />
				<span>{wnSortName(s.wn.sort).replace(" release", "").replace(" longest", "")}</span>
			</button>
		</div>
	)
}

export function WnDock() {
	const s = useShell()
	return (
		<div className="rn-dock">
			<button type="button" className="rn-pillbtn" onClick={() => s.setSheet("wn-moods")}>
				<MoodDots ms={s.wn.moods} size={20} />
				{moodText(s.wn.moods)}
				<ChevronDownIcon className="rn-i16" />
			</button>
			<span className="rn-dock-count">
				<b>{s.who === "guest" ? 3 : s.wn.everywhere ? 18 : 11}</b> {s.wn.everywhere ? "on your Wishlist" : "on your services"}
			</span>
			<span className="rn-grow" />
			<button type="button" className={`rn-pillbtn ${s.wn.everywhere ? "" : "is-light"}`} onClick={() => s.setWn({ ...s.wn, everywhere: !s.wn.everywhere })}>
				{s.wn.everywhere ? <GlobeAltIcon className="rn-i16" /> : <Logos ids={MY_SERVICES} size={20} />}
				{s.wn.everywhere ? "Everywhere" : "On my services"}
			</button>
			<button type="button" className="rn-pillbtn" onClick={() => s.setSheet("wn-sort")}>
				<ArrowsUpDownIcon className="rn-i16 rn-amber" />
				{wnSortName(s.wn.sort)}
				<ChevronDownIcon className="rn-i16" />
			</button>
		</div>
	)
}

export function DiscStrip({ compact }: { compact?: boolean }) {
	const s = useShell()
	const d = s.disc
	const guest = s.who === "guest"
	return (
		<div className={`rn-strip-wrap ${compact ? "is-compact" : ""}`}>
			{!compact && (
				<div className="rn-strip-meta">
					<span className="rn-meter">
						<i style={{ width: "34%" }} />
					</span>
					<span>
						<b>{d.everywhere ? 0 : 159}</b> hidden by filters
					</span>
					<span className="rn-grow" />
					<span className="rn-amber">+ {d.everywhere ? 0 : 151} on other services</span>
				</div>
			)}
			<div className={`rn-strip ${compact ? "is-compact" : ""}`}>
				<button type="button" className={`rn-seg ${d.everywhere ? "" : "is-green"}`} onClick={() => s.setDisc({ ...d, everywhere: !d.everywhere })}>
					{d.everywhere ? <GlobeAltIcon className="rn-i16" /> : <Logos ids={MY_SERVICES} size={15} />}
					<span>{d.everywhere ? "Everywhere" : compact ? "Services" : "My services"}</span>
				</button>
				<button type="button" className={`rn-seg ${d.unseen ? "is-blue" : ""}`} onClick={() => s.setDisc({ ...d, unseen: !d.unseen })}>
					<EyeSlashIcon className="rn-i16" />
					<span>{compact ? "Unseen" : "Not seen"}</span>
				</button>
				{!s.searching && (
					<button type="button" className={`rn-seg ${d.forYou && !guest ? "is-amber" : ""}`} onClick={() => (guest ? s.setSheet("signup") : s.setDisc({ ...d, forYou: !d.forYou }))}>
						{guest ? <LockClosedIcon className="rn-i16" /> : <FingerPrintIcon className="rn-i16" />}
						<span>{d.forYou && !guest && !compact ? "For you ↑31" : "For you"}</span>
					</button>
				)}
				<button type="button" className="rn-seg" onClick={() => s.setSheet("disc-sort")}>
					<ArrowsUpDownIcon className="rn-i16 rn-amber" />
					<span>{s.searching ? "Relevance" : (DISC_SORTS.find((x) => x.k === d.sort)?.name ?? "")}</span>
				</button>
				<button type="button" className="rn-seg is-icon" onClick={() => s.setSheet("filters")} aria-label="Filters">
					<AdjustmentsHorizontalIcon className="rn-i20" />
				</button>
			</div>
		</div>
	)
}

export function DiscRow() {
	const s = useShell()
	const d = s.disc
	const guest = s.who === "guest"
	return (
		<>
			<div className="rn-studio">
				<div className="rn-seg2">
					<button type="button" className={!d.everywhere ? "is-green" : ""} onClick={() => s.setDisc({ ...d, everywhere: false })}>
						<Logos ids={MY_SERVICES} size={18} /> On my services
					</button>
					<button type="button" className={d.everywhere ? "is-on" : ""} onClick={() => s.setDisc({ ...d, everywhere: true })}>
						<GlobeAltIcon className="rn-i16" /> Everywhere
					</button>
				</div>
				<button type="button" className="rn-pillbtn" onClick={() => s.setDisc({ ...d, unseen: !d.unseen })}>
					<EyeSlashIcon className="rn-i16" /> Not seen yet <span className="rn-dim">−6</span>
					<span className={`rn-switch ${d.unseen ? "is-on" : ""}`} />
				</button>
				<button type="button" className="rn-pillbtn is-sort" onClick={() => s.setSheet("disc-sort")}>
					<ArrowsUpDownIcon className="rn-i16" /> <span className="rn-dim">Sort</span> {s.searching ? "Relevance" : DISC_SORTS.find((x) => x.k === d.sort)?.name}
					<ChevronDownIcon className="rn-i16" />
				</button>
				{!s.searching && (
					<button type="button" className={`rn-pillbtn is-foryou ${d.forYou && !guest ? "is-glow" : ""}`} onClick={() => (guest ? s.setSheet("signup") : s.setDisc({ ...d, forYou: !d.forYou }))}>
						<FingerPrintIcon className="rn-i16 rn-amber" /> For you
						{guest ? <span className="rn-dim">Sign up</span> : <span className="rn-amber">↑31</span>}
						<span className={`rn-switch is-amber ${d.forYou && !guest ? "is-on" : ""}`} />
					</button>
				)}
				<span className="rn-grow" />
				<button type="button" className="rn-pillbtn" onClick={() => s.setSheet("filters")}>
					<AdjustmentsHorizontalIcon className="rn-i16" /> Filters <span className="rn-count">0</span>
				</button>
			</div>
			<div className="rn-subbar">
				<span className="rn-meter">
					<i style={{ width: "34%" }} />
				</span>
				<span>
					<b>61</b> showing, 159 hidden by your filters
				</span>
				<span className="rn-amber">+ 151 on other services</span>
				<span className="rn-amber">+ 6 you've seen</span>
			</div>
		</>
	)
}

export const TASTE_TABS: { k: TasteTab; name: string }[] = [
	{ k: "sides", name: "Sides of you" },
	{ k: "crowd", name: "You vs everyone" },
	{ k: "fingerprint", name: "Fingerprint" },
]

export function TasteTabs({ where }: { where: "top" | "bottom" | "header" }) {
	const s = useShell()
	return (
		<div className={`rn-ttabs is-${where}`} role="tablist">
			{TASTE_TABS.map((t) => (
				<button key={t.k} type="button" role="tab" aria-selected={s.tab === t.k} className={s.tab === t.k ? "is-on" : ""} onClick={() => s.setTab(t.k)}>
					{t.name}
				</button>
			))}
		</div>
	)
}

export function ExplorerControls({ where }: { where: "map" | "bottom" | "header" }) {
	const s = useShell()
	if (where === "bottom")
		return (
			<div className="rn-strip is-compact">
				<button type="button" className="rn-seg is-wide" onClick={() => s.setSheet("groups")}>
					<span className="rn-seg-big">Genre</span>
					<span>Grouping</span>
				</button>
				<button type="button" className="rn-seg" onClick={() => s.setDisc({ ...s.disc, everywhere: !s.disc.everywhere })}>
					<Logos ids={MY_SERVICES} size={15} />
					<span>My services</span>
				</button>
				<button type="button" className="rn-seg is-blue">
					<EyeSlashIcon className="rn-i16" />
					<span>Not seen</span>
				</button>
			</div>
		)
	return (
		<div className={`rn-xcontrols is-${where}`}>
			<div className="rn-xrow">
				<button type="button" className="rn-xgroup" onClick={() => s.setSheet("groups")}>
					Genre <ChevronDownIcon className="rn-i20" />
				</button>
				<span className="rn-xhist">
					<ArrowUturnLeftIcon className="rn-i16" />
					<b>All by genre</b>
					<ChevronDownIcon className="rn-i16" />
				</span>
			</div>
			<div className="rn-xrow">
				<button type="button" className="rn-xchip">
					<Logos ids={MY_SERVICES.slice(0, 2)} size={20} /> My services
				</button>
				<button type="button" className="rn-xchip">
					<span className="rn-check">✓</span> Not seen yet
				</button>
			</div>
		</div>
	)
}
