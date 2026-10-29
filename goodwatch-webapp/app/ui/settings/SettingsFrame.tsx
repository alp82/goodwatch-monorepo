// Settings inside the Taste area: every settings page in a slim column on desktop, or a chip row on a phone, the same
// rows as the account menu (SETTINGS_COLUMN in ui/navigation/areas.ts), then the page. Pages drawn with SettingsPage
// inside the frame get the small head and the frame's gutter.
import { Link, useLocation } from "@remix-run/react"
import {
	type ReactNode,
	createContext,
	useContext,
	useLayoutEffect,
	useMemo,
	useRef,
} from "react"
import { useUserData } from "~/routes/api.user-data"
import { WRAP } from "~/ui/my-pages/bits"
import { type Place, SETTINGS_COLUMN, placeHere } from "~/ui/navigation/areas"

const count = (n: number) => n.toLocaleString("en-US")

const InFrame = createContext(false)

/** True inside the Settings frame: SettingsPage then draws the small head without its own gutter. */
export const useInSettingsFrame = () => useContext(InFrame)

/** Not interested's number of titles, from the member's data. */
function useNotInterestedCount() {
	const { data } = useUserData()
	return useMemo(
		() => (data ? Object.keys(data.notInterested ?? {}).length : undefined),
		[data],
	)
}

function ColumnRow({
	place,
	here,
	n,
}: { place: Place; here: boolean; n?: number }) {
	if (!place.href) return null
	return (
		<Link
			to={place.href}
			prefetch="intent"
			aria-current={here ? "page" : undefined}
			className={`relative flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14px] font-medium ${
				here
					? "bg-white/[0.07] text-white"
					: "text-gray-400 hover:bg-white/[0.04] hover:text-gray-100"
			}`}
		>
			{here && (
				<span
					aria-hidden
					className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-amber-400"
				/>
			)}
			<place.icon
				className={`h-[18px] w-[18px] shrink-0 ${here ? "text-amber-300" : "text-gray-500"}`}
				aria-hidden
			/>
			<span className="grow truncate">{place.label}</span>
			{n != null && (
				<span className="text-xs tabular-nums text-gray-500">{count(n)}</span>
			)}
			{place.tag && (
				<span className="text-[11px] font-semibold text-gray-500">
					{place.tag}
				</span>
			)}
		</Link>
	)
}

function Chip({ place, here, n }: { place: Place; here: boolean; n?: number }) {
	if (!place.href) return null
	return (
		<Link
			to={place.href}
			prefetch="intent"
			preventScrollReset
			aria-current={here ? "page" : undefined}
			className={`flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold ring-1 ${
				here
					? "bg-amber-400/15 text-amber-100 ring-amber-400/50"
					: "bg-white/[0.04] text-gray-300 ring-white/10"
			}`}
		>
			<place.icon
				className={`h-4 w-4 ${here ? "text-amber-300" : "text-gray-500"}`}
				aria-hidden
			/>
			{place.label}
			{n != null && (
				<span
					className={`text-xs tabular-nums ${here ? "text-amber-200/80" : "text-gray-500"}`}
				>
					{count(n)}
				</span>
			)}
			{place.tag && (
				<span className="text-[11px] font-semibold text-gray-500">
					{place.tag}
				</span>
			)}
		</Link>
	)
}

export function SettingsFrame({ children }: { children: ReactNode }) {
	const { pathname } = useLocation()
	const notInterested = useNotInterestedCount()
	const countOf = (place: Place) =>
		place.count === "not-interested" ? notInterested : undefined
	const chips = useRef<HTMLDivElement>(null)
	// The phone's chip row keeps the current page in view.
	useLayoutEffect(() => {
		const box = chips.current
		const here = box?.querySelector<HTMLElement>("[aria-current='page']")
		if (!box || !here) return
		box.scrollLeft = Math.max(
			0,
			here.offsetLeft - (box.clientWidth - here.offsetWidth) / 2,
		)
	})
	return (
		<div className={`${WRAP} lg:flex lg:gap-8`} data-settings-frame>
			<aside className="hidden w-56 shrink-0 lg:block">
				<nav
					aria-label="Settings pages"
					className="sticky top-[113px] flex flex-col gap-4 pt-5 pb-10"
				>
					{SETTINGS_COLUMN.map((g) => (
						<div key={g.name}>
							<p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
								{g.name}
							</p>
							{g.places.map((p) => (
								<ColumnRow
									key={p.id}
									place={p}
									here={placeHere(p, pathname)}
									n={countOf(p)}
								/>
							))}
						</div>
					))}
				</nav>
			</aside>
			{/* Pages carry their own page gutter (WRAP); inside the frame the frame's gutter is the one. */}
			<div className="min-w-0 flex-1 [&_.max-w-7xl]:max-w-none [&_.max-w-7xl]:px-0">
				<nav
					ref={chips}
					aria-label="Settings pages"
					className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pt-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:hidden"
				>
					{SETTINGS_COLUMN.map((g, i) => (
						<span key={g.name} className="flex shrink-0 items-center gap-1.5">
							{i > 0 && (
								<span aria-hidden className="mx-1 h-5 w-px bg-white/15" />
							)}
							{g.places.map((p) => (
								<Chip
									key={p.id}
									place={p}
									here={placeHere(p, pathname)}
									n={countOf(p)}
								/>
							))}
						</span>
					))}
				</nav>
				<InFrame.Provider value={true}>{children}</InFrame.Provider>
			</div>
		</div>
	)
}
