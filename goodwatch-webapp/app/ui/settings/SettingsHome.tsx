// The Settings page: who you are, then one tile per group that shows what the setting does now (your country's flag
// and your services, a title in the language titles show in) and opens its sheet. Discover and privacy has its two
// switches on the tile itself.
import {
	ChevronRightIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"
import { useStreamingProviders } from "~/routes/api.streaming-providers"
import { useUserSettings } from "~/routes/api.user-settings.get"
import { useSetUserSettings } from "~/routes/api.user-settings.set"
import type { ConnectedApp } from "~/server/auth/connected-apps.server"
import { useCookieChoice } from "~/ui/CookieConsent"
import { TmdbImage } from "~/ui/TmdbImage"
import { ConnectAppBadge } from "~/ui/auth/connect"
import { CONNECTED_APPS_PATH } from "~/ui/connector/connector"
import { IMPORTS_PATH } from "~/ui/imports/shared"
import { useSettingsPair } from "~/ui/media-preference/SettingsPair"
import { englishName } from "~/ui/media-preference/languages"
import { BROWSER } from "~/ui/media-preference/machine"
import { localizedTextFetcher } from "~/ui/media-preference/useTitlePreview"
import Toggle from "~/ui/toggle/Toggle"
import { countryFlagUrl } from "~/utils/country-flag"
import { regionName } from "~/utils/display-names"
import { localizedTitleQueryKey } from "~/utils/media-presentation"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { savedServiceIds, useServicesInCountry } from "./YourServices"
import { useHiddenTitles } from "./hidden-titles"
import {
	ACCOUNT_PATH,
	HIDDEN_PATH,
	OPENED_FROM_TILES,
	PROFILE_PATH,
	TITLE_LANGUAGE_PATH,
	WHERE_YOU_WATCH_PATH,
} from "./paths"
import { titleIsIn } from "./sample-title"

/** The title the Show titles in tile shows in the chosen language, when it has a translation there: Spirited Away. */
const SAMPLE = { type: "movie", id: 129 } as const

export function SettingsHome({
	handle,
	email,
	connectedApps,
}: {
	handle: string | null
	email: string | null
	/** Null while apps can't connect (Better Auth is off): the tile stays away. */
	connectedApps: ConnectedApp[] | null
}) {
	return (
		<div className="mx-auto max-w-6xl px-4 py-4 pb-24 md:px-8 md:py-8">
			<header className="flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-br from-indigo-950 via-gray-900 to-gray-900 p-5 ring-1 ring-white/10 md:p-6">
				<span
					aria-hidden="true"
					className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-indigo-800 text-2xl font-black text-white uppercase md:h-20 md:w-20 md:text-3xl"
				>
					{(handle ?? email ?? "?").slice(0, 1)}
				</span>
				<div className="min-w-0 flex-1">
					<h1 className="text-sm font-normal text-gray-400">Your settings</h1>
					{handle ? (
						<p className="truncate text-2xl font-black text-white md:text-3xl">
							@{handle}
						</p>
					) : (
						<Link
							to={PROFILE_PATH}
							prefetch="intent"
							preventScrollReset
							state={OPENED_FROM_TILES}
							className="text-xl font-bold text-white hover:underline md:text-2xl"
						>
							Choose your handle
						</Link>
					)}
					{email && <p className="truncate text-sm text-gray-400">{email}</p>}
				</div>
				<div className="flex flex-wrap gap-2">
					<HeaderLink to={PROFILE_PATH}>Public profile</HeaderLink>
					<HeaderLink to={ACCOUNT_PATH}>Account and sign-in</HeaderLink>
				</div>
			</header>

			<div className="mt-4 grid gap-4 md:mt-6 md:grid-cols-2">
				<WhereYouWatchTile />
				<ShowTitlesInTile />
				<YourDataTile />
				{connectedApps && <ConnectedAppsTile apps={connectedApps} />}
				<DiscoverAndPrivacyTile />
			</div>
		</div>
	)
}

function HeaderLink({ to, children }: { to: string; children: ReactNode }) {
	return (
		<Link
			to={to}
			prefetch="intent"
			preventScrollReset
			state={OPENED_FROM_TILES}
			className="rounded-lg border border-gray-600 px-3 py-2 text-sm font-semibold text-gray-200 hover:border-gray-400 hover:text-white"
		>
			{children}
		</Link>
	)
}

const tileClass =
	"flex min-h-48 flex-col rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 md:p-6"

function TileHeading({ label, hint }: { label: string; hint: string }) {
	return (
		<>
			<span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
				{label}
			</span>
			<span className="mb-4 text-sm text-gray-400">{hint}</span>
		</>
	)
}

/** A tile that opens a sheet: the whole tile is the link. */
function LinkTile({
	to,
	label,
	hint,
	children,
}: { to: string; label: string; hint: string; children: ReactNode }) {
	return (
		<Link
			to={to}
			prefetch="intent"
			preventScrollReset
			state={OPENED_FROM_TILES}
			className={`group ${tileClass} transition-transform duration-150 hover:-translate-y-0.5 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
		>
			<TileHeading label={label} hint={hint} />
			<span className="mt-auto">{children}</span>
			<span className="mt-4 text-sm font-semibold text-amber-500 group-hover:text-amber-400">
				Change
			</span>
		</Link>
	)
}

function WhereYouWatchTile() {
	const { next } = useSettingsPair()
	const settings = useUserSettings()
	const ids = savedServiceIds(settings.data?.streaming_providers_default)
	const providers = useStreamingProviders({
		country: next.country,
		include: ids,
		enabled: Boolean(settings.data),
	})
	const mine = ids
		.map((id) => providers.data?.find((p) => String(p.id) === id))
		.filter((p) => p !== undefined)
	const { notice } = useServicesInCountry(next.country)
	return (
		<LinkTile
			to={WHERE_YOU_WATCH_PATH}
			label="Where you watch"
			hint="Your country and your streaming services"
		>
			<span className="flex items-center gap-3">
				<img
					src={countryFlagUrl(next.country)}
					alt=""
					className="h-8 rounded-sm md:h-10"
				/>
				<span className="text-2xl font-black text-white md:text-3xl">
					{regionName(next.country)}
				</span>
			</span>
			<span className="mt-4 flex flex-wrap items-center gap-1.5">
				{mine.length > 0 ? (
					<>
						{mine.slice(0, 7).map((p) => (
							<span
								key={p.id}
								title={p.name}
								className="h-10 w-10 overflow-hidden rounded-md bg-white/5 ring-1 ring-white/10"
							>
								<TmdbImage
									kind="logo"
									path={p.logo_path}
									width={40}
									ratio={1}
									className="h-full w-full object-cover"
									alt={p.name}
								/>
							</span>
						))}
						{mine.length > 7 && (
							<span className="text-sm text-gray-400">+{mine.length - 7}</span>
						)}
					</>
				) : (
					settings.data && (
						<span className="text-sm text-gray-400">
							No services picked yet
						</span>
					)
				)}
			</span>
			{notice && (
				<span className="mt-3 flex items-center gap-1.5 text-sm text-amber-300">
					<ExclamationTriangleIcon
						className="h-4 w-4 shrink-0"
						aria-hidden="true"
					/>
					{notice.empty
						? `None of your services stream in ${regionName(next.country)}`
						: notice.text}
				</span>
			)}
		</LinkTile>
	)
}

function ShowTitlesInTile() {
	const { p, next } = useSettingsPair()
	const language = next.language === BROWSER ? p.browserLanguage : next.language
	const sample = useQuery({
		queryKey: localizedTitleQueryKey(SAMPLE.type, SAMPLE.id, language),
		queryFn: ({ signal }) =>
			localizedTextFetcher({
				mediaType: SAMPLE.type,
				tmdbId: SAMPLE.id,
				language,
				signal,
			}),
		placeholderData: (previous) => previous,
	})
	// Only a title that is in that language (sample-title.ts): an untranslated one comes back in another.
	const title = titleIsIn(sample.data?.presentation?.title, language)
		? sample.data
		: null
	// "Japanese"; "German" and "Follows your browser" while it follows the browser.
	const name = englishName(language)
	const follows = next.language === BROWSER ? "Follows your browser" : null
	return (
		<LinkTile
			to={TITLE_LANGUAGE_PATH}
			label="Show titles in"
			hint="The language of titles, posters and descriptions"
		>
			{title ? (
				<span className="flex gap-4">
					{title.poster_path && (
						<img
							src={tmdbImageUrl(title.poster_path, "w154")}
							alt=""
							className="h-28 w-[4.7rem] shrink-0 rounded-md object-cover shadow-lg"
						/>
					)}
					<span className="min-w-0">
						<span
							lang={title.presentation?.title?.language}
							dir="auto"
							className="line-clamp-2 text-xl font-black text-white md:text-2xl"
						>
							{title.title}
						</span>
						<span className="mt-1 block text-sm text-gray-400">
							{follows ? `${name}, ${follows.toLowerCase()}` : name}
						</span>
					</span>
				</span>
			) : (
				// Without the sample title (still loading, or it couldn't load) the language alone.
				<span>
					<span className="block text-2xl font-black text-white md:text-3xl">
						{name}
					</span>
					{follows && (
						<span className="mt-1 block text-sm text-gray-400">{follows}</span>
					)}
				</span>
			)}
		</LinkTile>
	)
}

function YourDataTile() {
	const hidden = useHiddenTitles()
	const count = hidden.data?.titles.length
	const row =
		"flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white"
	return (
		<section className={tileClass} aria-label="Your data">
			<TileHeading
				label="Your data"
				hint="What you brought in, and what you asked not to see"
			/>
			<div className="-mx-3 mt-auto flex flex-col">
				<Link
					to={IMPORTS_PATH}
					prefetch="intent"
					preventScrollReset
					state={OPENED_FROM_TILES}
					className={row}
				>
					<span className="min-w-0 flex-1">
						<span className="block font-semibold text-gray-100">Imports</span>
						<span className="block text-sm text-gray-400">
							Ratings and watches from IMDb, Letterboxd and more
						</span>
					</span>
					<ChevronRightIcon
						className="h-4 w-4 shrink-0 text-gray-500"
						aria-hidden="true"
					/>
				</Link>
				<Link
					to={HIDDEN_PATH}
					prefetch="intent"
					preventScrollReset
					state={OPENED_FROM_TILES}
					className={row}
				>
					<span className="min-w-0 flex-1">
						<span className="block font-semibold text-gray-100">
							Hidden titles
						</span>
						<span className="block text-sm text-gray-400">
							{count === undefined
								? "Titles you marked Not interested"
								: count === 1
									? "1 title"
									: `${count} titles`}
						</span>
					</span>
					<ChevronRightIcon
						className="h-4 w-4 shrink-0 text-gray-500"
						aria-hidden="true"
					/>
				</Link>
			</div>
		</section>
	)
}

function ConnectedAppsTile({ apps }: { apps: ConnectedApp[] }) {
	return (
		<LinkTile
			to={CONNECTED_APPS_PATH}
			label="Connected apps"
			hint="Assistants that can reach your GoodWatch"
		>
			{apps.length > 0 ? (
				<span className="flex flex-wrap items-center gap-3">
					{apps.slice(0, 5).map((connected) => (
						<ConnectAppBadge key={connected.id} app={connected.app} />
					))}
					<span className="text-sm text-gray-400">
						{apps.length === 1 ? "1 connected" : `${apps.length} connected`}
					</span>
				</span>
			) : (
				<span className="text-sm text-gray-400">
					No apps connected. Add GoodWatch to Claude or ChatGPT.
				</span>
			)}
		</LinkTile>
	)
}

function DiscoverAndPrivacyTile() {
	const settings = useUserSettings()
	const save = useSetUserSettings()
	// The switch moves at once; the save follows, and a failed one puts it back.
	const [forYouNow, setForYouNow] = useState<boolean | null>(null)
	const forYou = forYouNow ?? settings.data?.for_you !== "no"
	const saveForYou = (on: boolean) => {
		setForYouNow(on)
		save.mutate(
			{ settings: { for_you: on ? "yes" : "no" } },
			{ onError: () => setForYouNow(null) },
		)
	}
	const [forYouTried, setForYouTried] = useState<boolean | null>(null)
	const cookies = useCookieChoice()
	const { consentGiven, setConsent } = cookies
	return (
		<section className={tileClass} aria-label="Discover and privacy">
			<TileHeading
				label="Discover and privacy"
				hint="How Discover orders titles, and cookies"
			/>
			<div className="mt-auto flex flex-col gap-4">
				<SwitchRow
					label="For you in Discover"
					hint="Lifts the titles that match your taste in the order you pick."
					checked={forYou}
					disabled={!settings.data}
					onChange={(on) => {
						setForYouTried(on)
						saveForYou(on)
					}}
				/>
				{save.isError && forYouTried !== null && (
					<SaveFailed what="For you" onRetry={() => saveForYou(forYouTried)} />
				)}
				<SwitchRow
					label="Cookies"
					hint={
						<>
							{consentGiven === "yes"
								? "Allowed."
								: consentGiven === "no"
									? "Declined."
									: "Not chosen yet."}{" "}
							<Link
								to="/privacy"
								className="underline underline-offset-2 hover:text-gray-200"
							>
								Privacy policy
							</Link>
						</>
					}
					checked={consentGiven === "yes"}
					disabled={consentGiven === ""}
					onChange={(on) => setConsent(on ? "yes" : "no")}
				/>
				{cookies.saveFailed && (
					<SaveFailed what="your cookie choice" onRetry={cookies.retry} />
				)}
			</div>
		</section>
	)
}

function SaveFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
	return (
		<p className="flex flex-wrap items-center gap-2 text-sm text-red-300">
			<span role="alert">Couldn't save {what}.</span>
			<button
				type="button"
				onClick={onRetry}
				className="h-8 cursor-pointer rounded-full bg-white px-3 font-semibold text-black hover:bg-gray-200"
			>
				Retry
			</button>
		</p>
	)
}

function SwitchRow({
	label,
	hint,
	checked,
	disabled,
	onChange,
}: {
	label: string
	hint: ReactNode
	checked: boolean
	disabled?: boolean
	onChange: (on: boolean) => void
}) {
	return (
		<div className="flex items-center gap-4">
			<div className="min-w-0 flex-1">
				<p className="font-semibold text-gray-100">{label}</p>
				<p className="text-sm text-gray-400">{hint}</p>
			</div>
			<Toggle
				size="sm"
				checked={checked}
				disabled={disabled}
				onChange={onChange}
				ariaLabel={label}
			/>
		</div>
	)
}
