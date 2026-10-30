// Settings inside the Taste area: every settings page in a slim column on desktop (phones reach them from the Settings
// home's tiles and come back with the top bar's "‹ Settings"), the
// same rows as the account menu (SETTINGS_COLUMN in ui/navigation/areas.ts), then the page. Pages drawn with SettingsPage
// inside the frame get the small head and the frame's gutter.
import { Link, useLocation } from "@remix-run/react"
import { type ReactNode, createContext, useContext, useMemo } from "react"
import { useUserData } from "~/routes/api.user-data"
import { WRAP } from "~/ui/my-pages/bits"
import { UNDER_TABS } from "~/ui/navigation/AreaTabs"
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

export function SettingsFrame({ children }: { children: ReactNode }) {
	const { pathname } = useLocation()
	const notInterested = useNotInterestedCount()
	const countOf = (place: Place) =>
		place.count === "not-interested" ? notInterested : undefined
	return (
		<>
			<div className={`${WRAP} lg:flex lg:gap-8`} data-settings-frame>
				<aside className="hidden w-56 shrink-0 lg:block">
					<nav
						aria-label="Settings pages"
						className={`sticky ${UNDER_TABS.one} flex flex-col gap-4 pt-5 pb-10`}
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
				<div className="min-w-0 flex-1 max-lg:pt-3 [&_.max-w-7xl]:max-w-none [&_.max-w-7xl]:px-0">
					<InFrame.Provider value={true}>{children}</InFrame.Provider>
				</div>
			</div>
		</>
	)
}
