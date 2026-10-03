import type { ReactNode } from "react"
import {
	type ExplorerService,
	GROUPING_NAMES,
	type Grouping,
} from "~/domain/explorer"
import type { TitleTypeFilter } from "~/domain/title-type"
import { Knob } from "~/ui/filter-bar/motion"
import { TypeFilter } from "~/ui/type-filter"
import { TMDB } from "./images"

interface TopBarProps {
	/** The groupings this viewer can choose, and the one shown. */
	groupings: Grouping[]
	grouping: Grouping
	onGrouping: (grouping: Grouping) => void
	onMyServices: boolean
	notSeenYet: boolean
	/** The viewer's services; without any, On my services can't be turned on. */
	services: ExplorerService[]
	onToggleServices: () => void
	onToggleUnseen: () => void
	/** The format (every title, movies, or shows) and anime (with it, only it, or without it). */
	titleType: TitleTypeFilter
	onTitleType: (type: TitleTypeFilter) => void
	/** Where the person has been: an icon button that opens the steps. */
	history?: ReactNode
}

/**
 * The controls over the map: the grouping (a segmented control, a select on narrow screens) and the filters (the
 * type, On my services, and Not seen yet), which hide titles (never dim them). On my services and Not seen yet are the
 * filter bar's controls in the bar's compact form: one switch each, lit and colored as the filter bar lights them.
 */
export function TopBar({
	groupings,
	grouping,
	onGrouping,
	onMyServices,
	notSeenYet,
	services,
	onToggleServices,
	onToggleUnseen,
	titleType,
	onTitleType,
	history,
}: TopBarProps) {
	const mine = services.filter((s) => s.mine && s.logo)
	return (
		<header className="ex-top">
			<div className="ex-row">
				<h1 className="ex-brand">Explorer</h1>
				<div
					role="radiogroup"
					aria-label="Lay the islands out by"
					className="ex-seg"
					onKeyDown={(e) => {
						const step =
							e.key === "ArrowRight" || e.key === "ArrowDown"
								? 1
								: e.key === "ArrowLeft" || e.key === "ArrowUp"
									? -1
									: 0
						if (!step) return
						e.preventDefault()
						const at = groupings.indexOf(grouping)
						const next =
							groupings[(at + step + groupings.length) % groupings.length]
						onGrouping(next)
						requestAnimationFrame(() =>
							e.currentTarget
								.querySelector<HTMLElement>('[aria-checked="true"]')
								?.focus(),
						)
					}}
				>
					{groupings.map((g) => (
						<button
							key={g}
							type="button"
							// biome-ignore lint/a11y/useSemanticElements: one option of the segmented control.
							role="radio"
							aria-checked={grouping === g}
							tabIndex={grouping === g ? 0 : -1}
							onClick={() => onGrouping(g)}
							className={`ex-seg-b ${grouping === g ? "ex-seg-on" : ""}`}
						>
							{GROUPING_NAMES[g]}
						</button>
					))}
				</div>
				<label className="ex-pick">
					<span className="sr-only">Lay the islands out by</span>
					<select
						value={grouping}
						onChange={(e) => onGrouping(e.target.value as Grouping)}
					>
						{groupings.map((g) => (
							<option key={g} value={g}>
								{GROUPING_NAMES[g]}
							</option>
						))}
					</select>
					<svg viewBox="0 0 12 8" aria-hidden="true" className="ex-caret">
						<path
							d="M1 1.5l5 5 5-5"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</label>
				{history}
				<TypeFilter
					value={titleType}
					onChange={onTitleType}
					align="right"
					className="ex-type"
				/>
				<div className="ex-filters">
					<button
						type="button"
						role="switch"
						aria-checked={onMyServices}
						onClick={onToggleServices}
						className="ex-tog ex-tog-services"
						disabled={!services.length}
						title={
							services.length
								? undefined
								: "Choose your streaming services in the settings"
						}
					>
						{mine.length > 0 && (
							<span className="ex-logos" aria-hidden="true">
								{mine.slice(0, 3).map((s) => (
									<img key={s.id} src={`${TMDB}/w92${s.logo}`} alt="" />
								))}
							</span>
						)}
						<span className="ex-wide">On my services</span>
						<span className="ex-narrow">My services</span>
					</button>
					<button
						type="button"
						role="switch"
						aria-checked={notSeenYet}
						onClick={onToggleUnseen}
						className="ex-tog"
					>
						Not seen yet
						<Knob
							on={notSeenYet}
							onClass="bg-blue-600 shadow-[0_0_14px_rgba(37,99,235,.6)]"
						/>
					</button>
				</div>
			</div>
		</header>
	)
}
