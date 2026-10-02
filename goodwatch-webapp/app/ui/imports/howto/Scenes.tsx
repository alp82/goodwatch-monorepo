import {
	ArrowDownTrayIcon,
	CheckIcon,
	StarIcon,
} from "@heroicons/react/20/solid"
import type { CSSProperties, ReactNode } from "react"

// The four scenes of the IMDb export explainer. They are schematic drawings: a neutral browser window and
// plain lists, not IMDb's design. All motion comes from the `gwhowto-*` classes in styles.ts, so a scene
// with animations off is simply its last frame.

/** Start an element's animation this many seconds into the scene. */
const at = (seconds: number, vars: Record<string, string> = {}) =>
	({ "--d": `${seconds}s`, ...vars }) as CSSProperties

function Browser({ url, children }: { url: string; children: ReactNode }) {
	return (
		<div className="flex h-full flex-col rounded-md bg-gray-900 ring-1 ring-white/10">
			<div className="flex items-center gap-2 border-b border-white/10 px-2.5 py-1.5">
				<div className="flex gap-1">
					<span className="size-1.5 rounded-full bg-gray-600" />
					<span className="size-1.5 rounded-full bg-gray-600" />
					<span className="size-1.5 rounded-full bg-gray-600" />
				</div>
				<div className="min-w-0 flex-1 truncate rounded bg-gray-800 px-2 py-0.5 text-[11px] leading-4 text-gray-300">
					{url}
				</div>
			</div>
			<div className="relative min-h-0 flex-1 p-2.5">{children}</div>
		</div>
	)
}

/**
 * A mouse pointer that glides onto whatever it is placed in and clicks it. Put it inside a `relative` box
 * around the target: it is pinned to that box's lower right, so it lands on the target at every width.
 */
function Cursor({ arriveAt }: { arriveAt: number }) {
	return (
		<span className="pointer-events-none absolute left-3/4 top-2/3 z-10">
			<span
				className="gwhowto-ripple absolute -left-3 -top-3 size-6 rounded-full bg-indigo-300"
				style={at(arriveAt + 0.1)}
			/>
			<svg
				aria-hidden="true"
				viewBox="0 0 16 20"
				className="gwhowto-cursor relative block h-5 w-4 drop-shadow"
				style={at(arriveAt - 1.1, { "--fx": "-90px", "--fy": "64px" })}
			>
				<path
					d="M1 1v15l4-3.6 2.6 6 2.5-1.1-2.6-5.9H13z"
					fill="#fff"
					stroke="#111827"
					strokeWidth="1.2"
					strokeLinejoin="round"
				/>
			</svg>
		</span>
	)
}

const RATINGS = [
	{ title: "Casablanca", year: 1942, rating: 9 },
	{ title: "Seven Samurai", year: 1954, rating: 10 },
	{ title: "Metropolis", year: 1927, rating: 8 },
]

function RatingsScene() {
	return (
		<Browser url="imdb.com/list/ratings">
			<div className="flex items-center justify-between gap-2">
				<div className="text-sm font-semibold text-gray-100">Your ratings</div>
				<div className="relative">
					<div
						className="gwhowto-press rounded bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white"
						style={at(2.5)}
					>
						Export
					</div>
					<Cursor arriveAt={2.4} />
				</div>
			</div>
			<div className="mt-2 space-y-1.5">
				{RATINGS.map((row, index) => (
					<div
						key={row.title}
						className="gwhowto-rise flex items-center gap-2 rounded bg-gray-800/70 px-2 py-1"
						style={at(0.15 + index * 0.15)}
					>
						<span className="h-6 w-4 shrink-0 rounded-sm bg-gray-600" />
						<span className="min-w-0 flex-1 truncate text-xs text-gray-200">
							{row.title} <span className="text-gray-400">({row.year})</span>
						</span>
						<span className="flex items-center gap-0.5 text-xs font-medium text-gray-100">
							<StarIcon className="size-3.5 text-amber-400" />
							{row.rating}
						</span>
					</div>
				))}
			</div>
			<div className="absolute inset-x-0 bottom-1.5 flex justify-center">
				<div
					className="gwhowto-rise rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-900 shadow-lg"
					style={at(3)}
				>
					Export started
				</div>
			</div>
		</Browser>
	)
}

function WaitScene() {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
			<div className="gwhowto-in relative size-14" style={at(0.1)}>
				<svg
					aria-hidden="true"
					viewBox="0 0 56 56"
					className="absolute inset-0 size-full"
				>
					<circle
						cx="28"
						cy="28"
						r="24"
						fill="none"
						stroke="#374151"
						strokeWidth="4"
					/>
					<path
						d="M28 14v14l8 5"
						fill="none"
						stroke="#e5e7eb"
						strokeWidth="3"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
				<svg
					aria-hidden="true"
					viewBox="0 0 56 56"
					className="gwhowto-spin absolute inset-0 size-full"
				>
					<path
						d="M28 4a24 24 0 0 1 24 24"
						fill="none"
						stroke="#818cf8"
						strokeWidth="4"
						strokeLinecap="round"
					/>
				</svg>
			</div>
			<div
				className="gwhowto-rise text-sm font-semibold text-gray-100"
				style={at(0.3)}
			>
				IMDb is preparing your file
			</div>
			<div className="gwhowto-rise text-sm text-indigo-300" style={at(0.9)}>
				This takes a few minutes
			</div>
		</div>
	)
}

function ExportsScene() {
	const readyAt = 1.4
	return (
		<Browser url="imdb.com/exports">
			<div className="text-sm font-semibold text-gray-100">Exports</div>
			<div
				className="gwhowto-rise mt-2 flex items-center gap-2 rounded bg-gray-800/70 px-2 py-1.5"
				style={at(0.15)}
			>
				<span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-100">
					Ratings
				</span>
				<span className="grid text-[11px] font-medium leading-4">
					<span
						className="gwhowto-out col-start-1 row-start-1 rounded-full bg-gray-700 px-2 py-0.5 text-center text-gray-200"
						style={at(readyAt)}
					>
						In progress
					</span>
					<span
						className="gwhowto-in col-start-1 row-start-1 rounded-full bg-emerald-800 px-2 py-0.5 text-center text-emerald-50"
						style={at(readyAt)}
					>
						Ready
					</span>
				</span>
				<span className="relative shrink-0">
					<span className="gwhowto-enable block" style={at(readyAt)}>
						<span
							className="gwhowto-press flex size-7 items-center justify-center rounded bg-indigo-600 text-white"
							style={at(3.2)}
						>
							<ArrowDownTrayIcon className="size-4" />
						</span>
					</span>
					<Cursor arriveAt={3.1} />
				</span>
			</div>
			<div className="absolute inset-x-0 bottom-1.5 flex justify-center">
				<div
					className="gwhowto-rise flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-900 shadow-lg"
					style={at(3.7)}
				>
					<ArrowDownTrayIcon className="size-3" />
					ratings.csv
				</div>
			</div>
		</Browser>
	)
}

function CsvFile() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 36 44"
			className="block h-11 w-9 drop-shadow-md"
		>
			<path
				d="M3 0h21l12 12v29a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3z"
				fill="#f3f4f6"
			/>
			<path d="M24 0l12 12H27a3 3 0 0 1-3-3z" fill="#9ca3af" />
			<rect x="0" y="22" width="36" height="13" fill="#047857" />
			<text
				x="18"
				y="32"
				textAnchor="middle"
				fontSize="9.5"
				fontWeight="700"
				fontFamily="ui-sans-serif, system-ui, sans-serif"
				fill="#fff"
			>
				CSV
			</text>
		</svg>
	)
}

function UploadScene() {
	const droppedAt = 2.7
	return (
		<div className="flex h-full flex-col gap-2">
			<div className="flex h-12 shrink-0 items-center gap-1.5 rounded-md bg-gray-900 pl-16 pr-3 text-xs text-gray-400 ring-1 ring-white/10">
				<ArrowDownTrayIcon className="size-3.5 shrink-0" />
				<span className="truncate">Downloads</span>
			</div>
			<div className="h-4 shrink-0 px-1 text-xs font-semibold leading-4 text-gray-300">
				GoodWatch
			</div>
			<div className="relative flex min-h-0 flex-1 items-center gap-5 rounded-md border border-dashed border-indigo-400/70 bg-indigo-500/10 px-3">
				<div
					className="gwhowto-in absolute -inset-px rounded-md border border-emerald-400 bg-emerald-500/10"
					style={at(droppedAt)}
				/>
				{/* The file is drawn at rest in the drop area and starts lifted up into the downloads bar. */}
				<div className="relative h-11 w-9 shrink-0">
					<div
						className="gwhowto-file relative z-10"
						style={at(0.3, { "--lift": "-116px" })}
					>
						<CsvFile />
					</div>
					<div
						className="gwhowto-pop absolute -bottom-2 -right-3 z-20 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-gray-950"
						style={at(droppedAt + 0.1)}
					>
						<CheckIcon className="size-3.5" />
					</div>
				</div>
				<div className="relative min-w-0">
					<div className="text-sm font-semibold text-gray-100">
						Drop your file here
					</div>
					<div
						className="gwhowto-in truncate text-xs text-emerald-300"
						style={at(droppedAt + 0.1)}
					>
						ratings.csv added
					</div>
				</div>
			</div>
		</div>
	)
}

export const SCENES = [RatingsScene, WaitScene, ExportsScene, UploadScene]
