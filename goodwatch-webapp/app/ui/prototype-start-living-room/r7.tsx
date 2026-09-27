// PROTOTYPE - throwaway. Round 7 of the final Remote (#186). Owner on round 6: "labeled" is best. Group Back,
// Home, and Search together: Home in the middle with only the house icon, Back on the left, Search on the
// right. Mood gets its own well together with other options (Explorer, Watch next, and ideas from the other
// prototype tickets). The streaming keys can sit further down the remote. More variations.
//
// Every layout: screen, wheel, the Back / Home / Search row, a well of feature keys, then the streaming keys
// low on the body, just above where the hand photo runs off the bottom of the window. Feature keys for pages
// the TV can't show yet open a card on the TV; nothing leaves the room.
import type { ReactNode } from "react"
import { Icon } from "./r3"
import type { PageId, Tv4 } from "./r4"
import { ICON, Lcd, type Props, Services, Shell } from "./r5"
import { Dial6, type Feel6, Remote6 } from "./r6"

export type Layout7 = "grid" | "tiles" | "centered" | "row" | "six" | "lead" | "tinted" | "labeled"

export const LAYOUTS7: Record<Layout7, { name: string; idea: string }> = {
	grid: {
		name: "Grid, aligned",
		idea: "Round 8: icons and names start at the same spot on every key, so the icons form two straight columns. The well's columns line up with the streaming keys below.",
	},
	tiles: {
		name: "Grid, tiles",
		idea: "Round 8: each key is a tile with the icon above the name, both centered, so every icon sits on the same line.",
	},
	centered: { name: "Grid (round 7)", idea: "Round 7's Feature grid: icon and name centered together, for comparison." },
	row: { name: "Feature row", idea: "The four features as round keys in one row, names printed underneath. Streaming keys in one row at the bottom." },
	six: {
		name: "Six features",
		idea: "Six smaller labeled keys: Mood, Watch next, Explorer, Taste, Discover, Pick for me. Streaming keys in one row.",
	},
	lead: { name: "Mood leads", idea: "Mood as one wide key on top of the well, Watch next, Explorer, and Taste under it as round keys." },
	tinted: {
		name: "Tinted features",
		idea: "Feature grid, but each feature's icon carries its own color, so the well reads at a glance. Colored streaming keys.",
	},
	labeled: { name: "Labeled (round 6)", idea: "Round 6's Labeled keys, unchanged, for comparison." },
}

export type Feat = "mood" | PageId | "picks"

export const FEAT: Record<Feat, { label: string; d: string; tint: string }> = {
	mood: { label: "Mood", d: ICON.mood, tint: "#fbbf24" },
	// Owner, round 8: the key reads "Watch now".
	watchnext: { label: "Watch now", d: "M6 4h12v16l-6-4-6 4z", tint: "#38bdf8" },
	explorer: { label: "Explorer", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z", tint: "#a78bfa" },
	taste: { label: "Taste", d: "M12 11v3M8.5 8.5a5 5 0 0 1 7 0M6 12a6 6 0 0 1 12 0v2M9 13v1a3 3 0 0 0 6 0", tint: "#f472b6" },
	discover: { label: "Discover", d: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z", tint: "#34d399" },
	picks: { label: "Pick for me", d: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z", tint: "#fb923c" },
}

export function useFeat(t: Tv4) {
	const on = (f: Feat) =>
		f === "mood" ? t.top.k === "moods" || t.mode === "mood" : f === "picks" ? t.top.k === "picks" : t.top.k === "page" && t.top.id === f
	const run = (f: Feat) => {
		if (f === "mood") t.pickMode("mood")
		else if (f === "picks") {
			t.click()
			t.startPicks()
		} else t.openPage(f)
	}
	return { on, run }
}

export function Remote7({ layout, feel, ...p }: Props & { layout: Layout7; feel?: Feel6 }) {
	if (layout === "labeled") return <Remote6 layout="labeled" feel={feel} {...p} />
	const { t } = p
	const f = useFeat(t)
	// Owner, round 7: the D-pad wheel.
	const wheel = feel ?? "dpad"
	const well =
		layout === "row" ? (
			<Well>
				<div className="flex justify-between px-1">
					{(["mood", "watchnext", "explorer", "taste"] as Feat[]).map((k) => (
						<RoundFeat key={k} k={k} f={f} />
					))}
				</div>
			</Well>
		) : layout === "six" ? (
			<Well>
				<div className="grid grid-cols-2 gap-2">
					{(["mood", "watchnext", "explorer", "taste", "discover", "picks"] as Feat[]).map((k) => (
						<WideFeat key={k} k={k} f={f} small />
					))}
				</div>
			</Well>
		) : layout === "lead" ? (
			<Well>
				<WideFeat k="mood" f={f} />
				<div className="mt-3 flex justify-around">
					{(["watchnext", "explorer", "taste"] as Feat[]).map((k) => (
						<RoundFeat key={k} k={k} f={f} />
					))}
				</div>
			</Well>
		) : (
			// Aligned: the well's 8 px inset and gap match the streaming keys' grid, so the columns line up.
			<Well tight={layout !== "centered" && layout !== "tinted"}>
				<div className={`grid grid-cols-2 ${layout === "centered" || layout === "tinted" ? "gap-2.5" : "gap-2"}`}>
					{(["mood", "watchnext", "explorer", "taste"] as Feat[]).map((k) =>
						layout === "tiles" ? (
							<TileFeat key={k} k={k} f={f} />
						) : (
							<WideFeat key={k} k={k} f={f} tint={layout === "tinted"} left={layout === "grid"} />
						),
					)}
				</div>
			</Well>
		)
	const cols = layout === "row" || layout === "six" ? 4 : 2
	return (
		<Shell {...p} gap="gap-0" className="lr6">
			{/* Ends where the hand photo leaves the window, so the streaming keys sit low but stay visible. */}
			<div className="mt-4 flex h-[612px] w-full flex-col items-center gap-5">
				<Lcd t={t} services={p.services} />
				<Dial6 t={t} feel={wheel} size={layout === "six" ? 184 : 196} />
				<NavRow t={t} />
				{well}
				<div className="flex-1" />
				<Services t={t} services={p.services} caps={layout === "tinted"} cols={cols} />
			</div>
		</Shell>
	)
}

// Back on the left, Home in the middle as a round key with only the house, Search on the right.
function NavRow({ t }: { t: Tv4 }) {
	const searching = t.mode === "search"
	return (
		<div className="flex w-full items-center gap-3">
			<button
				type="button"
				onClick={() => {
					t.click()
					t.back()
				}}
				className="lr2-key flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[12px] font-semibold uppercase tracking-wider"
			>
				<Icon d={ICON.back} className="h-[18px] w-[18px]" />
				Back
			</button>
			<button
				type="button"
				aria-label="Home"
				title="Home"
				onClick={() => {
					t.click()
					t.home()
				}}
				className="lr2-key flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
			>
				<Icon d={ICON.home} className="h-6 w-6" />
			</button>
			<button
				type="button"
				aria-pressed={searching}
				onClick={() => t.pickMode("search")}
				className={`lr2-key flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[12px] font-semibold uppercase tracking-wider ${searching ? "lr2-key-on" : ""}`}
			>
				<Icon d={ICON.search} className="h-[18px] w-[18px]" />
				Search
			</button>
		</div>
	)
}

function Well({ tight, children }: { tight?: boolean; children: ReactNode }) {
	return <div className={`lr6-well w-full rounded-[26px] ${tight ? "p-2" : "p-2.5"}`}>{children}</div>
}

export type F = ReturnType<typeof useFeat>

function WideFeat({ k, f, small, tint, left }: { k: Feat; f: F; small?: boolean; tint?: boolean; left?: boolean }) {
	const on = f.on(k)
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={() => f.run(k)}
			className={`lr2-key flex w-full items-center ${left ? "justify-start gap-2 whitespace-nowrap pl-3.5" : "justify-center gap-2"} rounded-full font-semibold uppercase ${small ? "h-10 text-[10.5px] tracking-wide" : left ? "h-11 text-[11px] tracking-wide" : "h-11 text-[11.5px] tracking-wider"} ${on ? "lr2-key-on" : ""}`}
		>
			<span style={tint ? { color: FEAT[k].tint } : undefined}>
				<Icon d={FEAT[k].d} className={small ? "h-4 w-4" : "h-[18px] w-[18px]"} />
			</span>
			{FEAT[k].label}
		</button>
	)
}

// Icon over name, both centered: every icon sits on the same line, whatever the name's length.
export function TileFeat({ k, f }: { k: Feat; f: F }) {
	const on = f.on(k)
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={() => f.run(k)}
			className={`lr2-key flex h-[60px] w-full flex-col items-center justify-center gap-1.5 rounded-[18px] text-[10.5px] font-semibold uppercase tracking-wider ${on ? "lr2-key-on" : ""}`}
		>
			<Icon d={FEAT[k].d} className="h-5 w-5" />
			{FEAT[k].label}
		</button>
	)
}

function RoundFeat({ k, f }: { k: Feat; f: F }) {
	const on = f.on(k)
	return (
		<div className="flex flex-col items-center gap-1.5">
			<button
				type="button"
				aria-label={FEAT[k].label}
				aria-pressed={on}
				onClick={() => f.run(k)}
				className={`lr2-key flex h-12 w-12 items-center justify-center rounded-full ${on ? "lr2-key-on" : ""}`}
			>
				<Icon d={FEAT[k].d} className="h-5 w-5" />
			</button>
			<span className="lr5-print w-[58px] text-center leading-tight" aria-hidden>
				{FEAT[k].label}
			</span>
		</div>
	)
}
