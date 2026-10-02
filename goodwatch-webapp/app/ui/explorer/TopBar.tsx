import { ListBulletIcon } from "@heroicons/react/24/solid"
import type { ReactNode } from "react"
import {
	type ExplorerService,
	GROUPING_NAMES,
	type Grouping,
} from "~/domain/explorer"
import type { TitleTypeFilter } from "~/domain/title-type"
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
	/** Where the person has been (the last two steps and a dropdown): second row, first row on phones. */
	history?: ReactNode
	/** The list view: the same islands and titles as headings and links. */
	listView: boolean
	onToggleList: () => void
}

/**
 * The controls over the map: the grouping (a segmented control, a select on narrow screens) and the filters (the
 * type, On my services, and Not seen yet), which hide titles (never dim them).
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
	listView,
	onToggleList,
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
				{history && <div className="ex-hist-top">{history}</div>}
				<TypeFilter
					value={titleType}
					onChange={onTitleType}
					expandFrom="wide"
					align="right"
					className="ex-type"
				/>
				<div className="ex-filters">
					<button
						type="button"
						role="switch"
						aria-checked={onMyServices}
						onClick={onToggleServices}
						className="ex-tog"
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
						<span className="ex-tick" aria-hidden="true" />
						Not seen yet
					</button>
					<button
						type="button"
						aria-pressed={listView}
						onClick={onToggleList}
						className="ex-tog ex-list-tog"
						aria-label="List"
					>
						<ListBulletIcon className="ex-i" aria-hidden="true" />
						<span className="ex-wide-list" aria-hidden="true">
							List
						</span>
					</button>
				</div>
			</div>
			{history && (
				<div className="ex-row ex-row2">
					<div className="ex-hist-side">{history}</div>
				</div>
			)}
		</header>
	)
}
