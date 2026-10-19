// The Settings page: who you are, then one tile per setting. Each tile is one link to its own page and shows what the
// setting is now: your country's flag, your language's flag with a title in it, your services' logos, where your
// imports came from, your connected apps, and the Discover and cookie choices. Profile and Account follow, then a link
// to My library, where Hidden titles live.
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { BookOpenIcon, ShieldCheckIcon, UserCircleIcon } from "@heroicons/react/24/outline"
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import type { ComponentType, ReactNode, SVGProps } from "react"
import { useStreamingProviders } from "~/routes/api.streaming-providers"
import { useUserSettings } from "~/routes/api.user-settings.get"
import type { ConnectedApp } from "~/server/auth/connected-apps.server"
import { useCookieChoice } from "~/ui/CookieConsent"
import { TmdbImage } from "~/ui/TmdbImage"
import { ConnectAppBadge } from "~/ui/auth/connect"
import { CONNECTED_APPS_PATH } from "~/ui/connector/connector"
import { IMPORT_SOURCE_LIST, importSourceName, lastImported } from "~/ui/imports/ImportSources"
import { SourceMark } from "~/ui/imports/SourceMark"
import { useSourceImports } from "~/ui/imports/SourceImportHooks"
import { useImdbImports } from "~/ui/imports/api"
import { IMPORTS_PATH, formatDate } from "~/ui/imports/shared"
import { Flag } from "~/ui/media-preference/PickerGrids"
import { useSettingsPair } from "~/ui/media-preference/SettingsPair"
import { englishName, languageFlag, ownName } from "~/ui/media-preference/languages"
import { BROWSER } from "~/ui/media-preference/machine"
import { MY_LIBRARY } from "~/ui/my-pages/bits"
import { regionName } from "~/utils/display-names"
import { useHydrated } from "~/utils/hydrated"
import { SampleTitleLine } from "./SampleTitle"
import { savedServiceIds, useServicesInCountry } from "./YourServices"
import {
	ACCOUNT_PATH,
	COUNTRY_PATH,
	DISCOVER_PRIVACY_PATH,
	PROFILE_PATH,
	SERVICES_PATH,
	TITLE_LANGUAGE_PATH,
} from "./paths"

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
							className="text-xl font-bold text-white hover:underline md:text-2xl"
						>
							Choose your handle
						</Link>
					)}
					{email && <p className="truncate text-sm text-gray-400">{email}</p>}
				</div>
			</header>

			<div className="mt-4 grid gap-4 md:mt-6 md:grid-cols-2">
				<WatchingFromTile />
				<ShowTitlesInTile />
				<YourServicesTile />
				<ImportsTile wide={!connectedApps} />
				{connectedApps && <ConnectedAppsTile apps={connectedApps} />}
				<DiscoverAndPrivacyTile />
			</div>

			<h2 className="mt-10 mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">You</h2>
			<div className="grid gap-4 sm:grid-cols-2">
				<RowLink
					to={PROFILE_PATH}
					icon={UserCircleIcon}
					name="Public profile"
					hint={handle ? `@${handle} · goodwatch.app/u/${handle}` : "Choose the handle that signs your lists"}
				/>
				<RowLink to={ACCOUNT_PATH} icon={ShieldCheckIcon} name="Account and sign-in" hint="Email, password and sign-in methods" />
			</div>

			<Link
				to={MY_LIBRARY}
				prefetch="intent"
				data-settings-library
				className="group mt-10 flex items-center gap-4 rounded-2xl border border-dashed border-white/15 p-5 hover:border-white/30 hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-white"
			>
				<BookOpenIcon className="h-7 w-7 shrink-0 text-amber-400" aria-hidden />
				<span className="min-w-0 flex-1">
					<b className="block text-white">My library</b>
					<span className="block text-sm text-gray-400">Your scores, lists and hidden titles live in My library.</span>
				</span>
				<ChevronRightIcon className="h-5 w-5 shrink-0 text-gray-600 group-hover:text-amber-300" aria-hidden />
			</Link>
		</div>
	)
}

const tileClass =
	"group flex min-h-48 flex-col rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 transition-transform duration-150 hover:-translate-y-0.5 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:p-6"

/** A tile: the whole tile is one link to its page. Its content starts under the heading, so tiles side by side line up. */
function Tile({
	to,
	label,
	hint,
	className = "",
	children,
}: { to: string; label: string; hint: string; className?: string; children: ReactNode }) {
	return (
		<Link to={to} prefetch="intent" data-settings-tile={label} className={`${tileClass} ${className}`}>
			<span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{label}</span>
			<span className="mb-4 text-sm text-gray-400">{hint}</span>
			<span>{children}</span>
			<span className="mt-auto pt-4 text-sm font-semibold text-amber-500 group-hover:text-amber-400">Open</span>
		</Link>
	)
}

/** A flag and a name, large, with a line under it: the country and the language tiles. */
function FlagName({ flag, name, line }: { flag: string; name: string; line: ReactNode }) {
	return (
		<>
			<span className="flex items-center gap-3">
				<Flag code={flag} className="h-8 md:h-10" />
				<span className="truncate text-2xl font-black text-white md:text-3xl">{name}</span>
			</span>
			<span className="mt-1 block text-sm text-gray-400">{line}</span>
		</>
	)
}

function WatchingFromTile() {
	const { next } = useSettingsPair()
	return (
		<Tile to={COUNTRY_PATH} label="Watching from" hint="Your country">
			<FlagName flag={next.country} name={regionName(next.country)} line="Streaming offers and age ratings" />
		</Tile>
	)
}

function ShowTitlesInTile() {
	const { p, next } = useSettingsPair()
	const language = next.language === BROWSER ? p.browserLanguage : next.language
	return (
		<Tile to={TITLE_LANGUAGE_PATH} label="Show titles in" hint="The language of titles, posters and descriptions">
			<FlagName
				flag={languageFlag(language)}
				name={englishName(language)}
				line={next.language === BROWSER ? "Follows your browser" : ownName(language) || "Chosen by you"}
			/>
			<SampleTitleLine language={language} />
		</Tile>
	)
}

function YourServicesTile() {
	const { next } = useSettingsPair()
	const settings = useUserSettings()
	const ids = savedServiceIds(settings.data?.streaming_providers_default)
	const providers = useStreamingProviders({ country: next.country, include: ids, enabled: Boolean(settings.data) })
	const mine = ids.map((id) => providers.data?.find((p) => String(p.id) === id)).filter((p) => p !== undefined)
	const { notice } = useServicesInCountry(next.country)
	const MAX = 12
	return (
		<Tile to={SERVICES_PATH} label="Your services" hint="The streaming services you have" className="md:col-span-2 md:min-h-0">
			<span className="flex flex-wrap items-center gap-x-6 gap-y-3">
				{mine.length > 0 ? (
					<>
						<span className="flex flex-wrap items-center gap-1.5">
							{mine.slice(0, MAX).map((p) => (
								<span key={p.id} title={p.name} className="h-12 w-12 overflow-hidden rounded-md bg-white/5 ring-1 ring-white/10">
									<TmdbImage kind="logo" path={p.logo_path} width={48} ratio={1} className="h-full w-full object-cover" alt={p.name} />
								</span>
							))}
							{mine.length > MAX && <span className="text-sm text-gray-400">+{mine.length - MAX}</span>}
						</span>
						<span className="text-sm text-gray-400">
							{mine.length === 1 ? "1 service" : `${mine.length} services`} in {regionName(next.country)}
						</span>
					</>
				) : (
					settings.data && <span className="text-sm text-gray-400">No services picked yet</span>
				)}
			</span>
			{notice && (
				<span className="mt-3 flex items-center gap-1.5 text-sm text-amber-300">
					<ExclamationTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
					{notice.empty ? `None of your services stream in ${regionName(next.country)}` : notice.text}
				</span>
			)}
		</Tile>
	)
}

function ImportsTile({ wide }: { wide: boolean }) {
	const imdb = useImdbImports()
	const native = useSourceImports()
	const hydrated = useHydrated()
	const latest = [...lastImported(imdb.data?.imports ?? [], native.data?.imports ?? [])].sort((a, b) => b[1].localeCompare(a[1]))
	const marks = latest.length
		? latest.map(([id]) => IMPORT_SOURCE_LIST.find((s) => s.id === id)).filter((s) => s !== undefined)
		: IMPORT_SOURCE_LIST.slice(0, 4)
	const [lastId, lastAt] = latest[0] ?? []
	return (
		<Tile
			to={IMPORTS_PATH}
			label="Imports"
			hint="Ratings and watches from IMDb, Letterboxd and more"
			className={wide ? "md:col-span-2" : ""}
		>
			<span className="flex items-center gap-3">
				<span className="flex shrink-0 -space-x-2">
					{marks.slice(0, 4).map((s) => (
						<span key={s.id} className="rounded-xl ring-4 ring-gray-950">
							<SourceMark source={s} />
						</span>
					))}
				</span>
				<span className="min-w-0">
					<span className="block font-semibold text-gray-100">
						{lastId && lastAt
							? `Last: ${importSourceName(lastId)}${hydrated ? `, ${formatDate(lastAt)}` : ""}`
							: "Nothing imported yet"}
					</span>
					<span className="block text-sm text-gray-400">Drop a file or connect an account</span>
				</span>
			</span>
		</Tile>
	)
}

function ConnectedAppsTile({ apps }: { apps: ConnectedApp[] }) {
	return (
		<Tile to={CONNECTED_APPS_PATH} label="Connected apps" hint="Assistants that can reach your GoodWatch">
			{apps.length > 0 ? (
				<span className="flex flex-wrap items-center gap-3">
					{apps.slice(0, 5).map((connected) => (
						<ConnectAppBadge key={connected.id} app={connected.app} />
					))}
					<span className="text-sm text-gray-400">{apps.length === 1 ? "1 connected" : `${apps.length} connected`}</span>
				</span>
			) : (
				<span className="text-sm text-gray-400">No apps connected. Add GoodWatch to Claude or ChatGPT.</span>
			)}
		</Tile>
	)
}

/** A state on the Discover and privacy tile: amber when on. */
function Chip({ on, children }: { on: boolean; children: ReactNode }) {
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${on ? "bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/40" : "bg-white/[0.06] text-gray-400 ring-1 ring-white/10"}`}
		>
			<span aria-hidden className={`size-2 rounded-full ${on ? "bg-amber-400" : "bg-gray-500"}`} />
			{children}
		</span>
	)
}

function DiscoverAndPrivacyTile() {
	const settings = useUserSettings()
	const { consentGiven } = useCookieChoice()
	const forYou = settings.data?.for_you !== "no"
	return (
		<Tile
			to={DISCOVER_PRIVACY_PATH}
			label="Discover and privacy"
			hint="How Discover orders titles, and cookies"
			className="md:col-span-2 md:min-h-0"
		>
			<span className="flex flex-wrap gap-2">
				{settings.data && <Chip on={forYou}>{forYou ? "For you on" : "For you off"}</Chip>}
				{consentGiven !== "" && (
					<Chip on={consentGiven === "yes"}>
						{consentGiven === "yes" ? "Cookies allowed" : consentGiven === "no" ? "Cookies declined" : "Cookies not chosen"}
					</Chip>
				)}
			</span>
		</Tile>
	)
}

function RowLink({
	to,
	icon: Icon,
	name,
	hint,
}: { to: string; icon: ComponentType<SVGProps<SVGSVGElement>>; name: string; hint: string }) {
	return (
		<Link
			to={to}
			prefetch="intent"
			className="group flex items-center gap-4 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white"
		>
			<Icon className="h-7 w-7 shrink-0 text-gray-400" aria-hidden />
			<span className="min-w-0 flex-1">
				<b className="block text-white">{name}</b>
				<span className="block truncate text-sm text-gray-400">{hint}</span>
			</span>
			<ChevronRightIcon className="h-5 w-5 shrink-0 text-gray-600 group-hover:text-amber-300" aria-hidden />
		</Link>
	)
}
