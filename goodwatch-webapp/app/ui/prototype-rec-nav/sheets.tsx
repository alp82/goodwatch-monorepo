// PROTOTYPE - throwaway. #192: every drawer and overlay of the shell. On phones they are bottom sheets; on desktop
// the control sheets open from the side (the `studio` Filters sheet), the hub drops below the header, and the
// command palette sits in the middle. Watch next's three buttons each open their own drawer (#176 addendum).
import { ArrowRightIcon, CheckIcon, LockClosedIcon, MagnifyingGlassIcon } from "@heroicons/react/24/solid"
import { useEffect, useRef, useState } from "react"
import { GMark, Logos, PAGE_ICON } from "./bits"
import { TITLES } from "./data"
import { DISC_SORTS, MOODS, MY_SERVICES, PAGES, type PageKey, type SheetKey, WN_SORTS, img, pageLabel, useShell } from "./model"

function Sheet({ title, kind = "control", children, onClose }: { title?: string; kind?: "control" | "hub" | "cmd"; children: React.ReactNode; onClose: () => void }) {
	useEffect(() => {
		const k = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		window.addEventListener("keydown", k)
		return () => window.removeEventListener("keydown", k)
	})
	return (
		<div className={`rn-sheetwrap is-${kind}`}>
			<button type="button" className="rn-scrim" aria-label="Close" onClick={onClose} />
			<div className="rn-sheet" role="dialog" aria-label={title}>
				<span className="rn-handlebar" />
				{title && <h3 className="rn-sheet-title">{title}</h3>}
				{children}
			</div>
		</div>
	)
}

function WnMoods() {
	const s = useShell()
	const toggle = (k: string) => {
		const on = s.wn.moods.includes(k)
		if (!on && s.wn.moods.length >= 3) return
		s.setWn({ ...s.wn, moods: on ? s.wn.moods.filter((m) => m !== k) : [...s.wn.moods, k] })
	}
	return (
		<>
			<p className="rn-sheet-sub">Up to three. Counts are titles on your Wishlist that fit.</p>
			<div className="rn-moodgrid">
				{MOODS.map((m, i) => (
					<button type="button" key={m.k} className={s.wn.moods.includes(m.k) ? "is-on" : ""} onClick={() => toggle(m.k)} style={{ ["--h" as string]: m.hue }}>
						<i />
						{m.name}
						<small>{[3, 4, 2, 5, 1, 6, 4, 2, 3, 1, 2][i]}</small>
					</button>
				))}
			</div>
		</>
	)
}

function WnServices() {
	const s = useShell()
	return (
		<div className="rn-list">
			<button type="button" className={!s.wn.everywhere ? "is-on" : ""} onClick={() => s.setWn({ ...s.wn, everywhere: false })}>
				<Logos ids={MY_SERVICES} size={24} /> On my services <small>11</small>
			</button>
			<button type="button" className={s.wn.everywhere ? "is-on" : ""} onClick={() => s.setWn({ ...s.wn, everywhere: true })}>
				Everywhere <small>18</small>
			</button>
		</div>
	)
}

function WnSort() {
	const s = useShell()
	const guest = s.who === "guest"
	return (
		<div className="rn-list">
			{WN_SORTS.map((o) => {
				const locked = guest && "needsTaste" in o
				return (
					<button type="button" key={o.k} className={s.wn.sort === o.k ? "is-on" : ""} onClick={() => (locked ? s.setSheet("signup") : s.setWn({ ...s.wn, sort: o.k }))}>
						{o.name}
						{locked ? (
							<small className="rn-amber">
								<LockClosedIcon className="rn-i16" /> Sign up
							</small>
						) : (
							s.wn.sort === o.k && <CheckIcon className="rn-i20 rn-amber" />
						)}
					</button>
				)
			})}
		</div>
	)
}

function DiscSort() {
	const s = useShell()
	const opts = s.searching ? [{ k: "rel", name: "Relevance" }, ...DISC_SORTS] : DISC_SORTS
	return (
		<div className="rn-list">
			{opts.map((o) => (
				<button type="button" key={o.k} className={(s.searching ? "rel" : s.disc.sort) === o.k ? "is-on" : ""} onClick={() => s.setDisc({ ...s.disc, sort: o.k })}>
					{o.name}
				</button>
			))}
		</div>
	)
}

function Filters() {
	const s = useShell()
	return (
		<>
			<div className="rn-sfield is-small">
				<MagnifyingGlassIcon className="rn-i16" />
				<input placeholder="Find a filter" aria-label="Find a filter" />
			</div>
			{[
				["Type", ["Movies 34", "Shows 27"]],
				["Genres", ["Crime 12", "Drama 22", "Comedy 9", "Sci-fi 7", "Animation 5"]],
				["Released", ["2020s 31", "2010s 17", "2000s 8", "Older 5"]],
			].map(([h, xs]) => (
				<div key={h as string} className="rn-fgroup">
					<h4>{h}</h4>
					<div>
						{(xs as string[]).map((x) => (
							<span key={x} className="rn-fchip">
								{x.replace(/ \d+$/, "")} <small>{x.match(/\d+$/)?.[0]}</small>
							</span>
						))}
					</div>
				</div>
			))}
			<button type="button" className="rn-primary" onClick={() => s.setSheet(null)}>
				Show 61 titles
			</button>
		</>
	)
}

function Groups() {
	const s = useShell()
	return (
		<div className="rn-list">
			{["Genre", "Mood", "Streaming", "Decade", "Country", "Taste distance"].map((g, i) => (
				<button type="button" key={g} className={i === 0 ? "is-on" : ""} onClick={() => s.setSheet(null)}>
					{g}
				</button>
			))}
		</div>
	)
}

function SignUp() {
	const s = useShell()
	return (
		<div className="rn-signupsheet">
			<GMark size={40} />
			<h3>Keep your taste and your Wishlist</h3>
			<p>Best match, For you and moods over your Wishlist learn from what you rate. An account keeps it on every device.</p>
			<button type="button" className="rn-primary">
				Sign up with Google
			</button>
			<button type="button" className="rn-textbtn" onClick={() => s.setSheet(null)}>
				Not now
			</button>
		</div>
	)
}

/** Variant `hub`: one button opens every destination, laid out like the remote's feature well. */
function Hub() {
	const s = useShell()
	const guest = s.who === "guest"
	const tile = (k: PageKey, sub: string) => {
		const Icon = PAGE_ICON[k]
		return (
			<button type="button" key={k} className={`rn-hubkey k-${k} ${s.page === k ? "is-on" : ""}`} onClick={() => s.go(k)}>
				{k === "watch" && <img src={img(s.tonight.backdrop, "w300")} alt="" />}
				<Icon className="rn-i24" />
				<b>{pageLabel(k)}</b>
				<small>{sub}</small>
			</button>
		)
	}
	return (
		<div className="rn-hub">
			<button type="button" className="rn-hub-search" onClick={s.openSearch}>
				<MagnifyingGlassIcon className="rn-i20" /> Search titles, people, moods
			</button>
			<div className="rn-hub-well">
				{tile("watch", guest ? "3 on your Wishlist" : `${s.tonight.title} tonight`)}
				{tile("discover", "Browse and search")}
				{tile("taste", guest ? "Demo taste" : "Sides of you")}
				{tile("explorer", "Islands map")}
			</div>
			<button type="button" className={`rn-hub-home ${s.page === "home" ? "is-on" : ""}`} onClick={() => s.go("home")}>
				<span className="rn-hub-homekey">
					<GMark size={18} />
				</span>
				Living room
			</button>
			{guest ? (
				<button type="button" className="rn-hub-cta" onClick={() => s.setSheet("signup")}>
					<b>Sign up</b> to keep your Wishlist and let Best match learn your taste
					<ArrowRightIcon className="rn-i16" />
				</button>
			) : (
				<div className="rn-hub-me">
					<span className="rn-avatar">A</span> Alper <span className="rn-grow" />
					<span className="rn-dim">Wishlist, Lists, Settings</span>
				</div>
			)}
		</div>
	)
}

/** Variant `command`: one field that goes anywhere; typing a title searches Discover. */
function Command() {
	const s = useShell()
	const [q, setQ] = useState("")
	const [i, setI] = useState(0)
	const input = useRef<HTMLInputElement>(null)
	useEffect(() => input.current?.focus(), [])
	const ql = q.trim().toLowerCase()
	type Row = { key: string; label: string; sub?: string; icon?: PageKey; poster?: string; run: () => void }
	const dest: Row[] = PAGES.filter((p) => !ql || p.label.toLowerCase().includes(ql) || p.k.includes(ql)).map((p) => ({
		key: p.k,
		label: `Go to ${p.label}`,
		sub: s.page === p.k ? "You're here" : p.k === "watch" ? `${s.tonight.title} is up next` : undefined,
		icon: p.k,
		run: () => s.go(p.k),
	}))
	const titles: Row[] = ql
		? TITLES.filter((t) => t.title.toLowerCase().includes(ql))
				.slice(0, 4)
				.map((t) => ({ key: `t${t.id}`, label: t.title, sub: `${t.type === "show" ? "Series" : "Movie"}, ${t.year}`, poster: t.poster, run: () => s.go("discover", { s: "1", q: t.title }) }))
		: []
	const search: Row[] = ql ? [{ key: "search", label: `Search Discover for “${q.trim()}”`, icon: "discover", run: () => s.go("discover", { s: "1", q: q.trim() }) }] : []
	const extra: Row[] = s.who === "guest" && (!ql || "sign up".includes(ql)) ? [{ key: "signup", label: "Sign up", sub: "Keep your Wishlist and taste", run: () => s.setSheet("signup") }] : []
	const rows = [...search, ...titles, ...dest, ...extra]
	const at = Math.min(i, rows.length - 1)
	return (
		<div className="rn-cmd">
			<div className="rn-sfield">
				<MagnifyingGlassIcon className="rn-i20" />
				<input
					ref={input}
					value={q}
					onChange={(e) => {
						setQ(e.target.value)
						setI(0)
					}}
					onKeyDown={(e) => {
						if (e.key === "ArrowDown") (setI(Math.min(at + 1, rows.length - 1)), e.preventDefault())
						if (e.key === "ArrowUp") (setI(Math.max(at - 1, 0)), e.preventDefault())
						if (e.key === "Enter") rows[at]?.run()
					}}
					placeholder="Search or go to…"
					aria-label="Search or go to"
				/>
				<kbd>esc</kbd>
			</div>
			<div className="rn-cmd-list">
				{rows.map((r, k) => {
					const Icon = r.icon ? PAGE_ICON[r.icon] : null
					return (
						<button type="button" key={r.key} className={k === at ? "is-at" : ""} onMouseEnter={() => setI(k)} onClick={r.run}>
							{r.poster ? <img src={img(r.poster, "w92")} alt="" /> : Icon ? <Icon className="rn-i20" /> : <GMark size={18} />}
							<span>
								<b>{r.label}</b>
								{r.sub && <small>{r.sub}</small>}
							</span>
						</button>
					)
				})}
			</div>
		</div>
	)
}

const TITLES_OF: Partial<Record<Exclude<SheetKey, null>, string>> = {
	"wn-moods": "Moods",
	"wn-services": "Where to watch",
	"wn-sort": "Sort",
	"disc-sort": "Sort",
	filters: "Filters",
	groups: "Group islands by",
}

export function Sheets() {
	const s = useShell()
	if (!s.sheet || s.sheet === "navpanel") return null
	const close = () => s.setSheet(null)
	const body =
		s.sheet === "wn-moods" ? <WnMoods /> : s.sheet === "wn-services" ? <WnServices /> : s.sheet === "wn-sort" ? <WnSort /> : s.sheet === "disc-sort" ? <DiscSort /> : s.sheet === "filters" ? <Filters /> : s.sheet === "groups" ? <Groups /> : s.sheet === "signup" ? <SignUp /> : s.sheet === "hub" ? <Hub /> : <Command />
	const kind = s.sheet === "hub" ? "hub" : s.sheet === "cmd" ? "cmd" : "control"
	return (
		<Sheet key={s.sheet} title={TITLES_OF[s.sheet]} kind={kind} onClose={close}>
			{body}
		</Sheet>
	)
}
