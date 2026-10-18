// PROTOTYPE - throwaway (settings subpages). The bodies of the subpages that every variant shares as they are: each
// variant decides the frame around them (heading, back link, side list) and builds its own Imports page. The pieces
// come from parts.tsx (real lists on fake member state). Nothing saves.
import { useId, useState } from "react"
import { Switch } from "~/ui/toggle/Switch"
import { regionName } from "~/utils/display-names"
import { ConnectAppBadge } from "~/ui/auth/connect"
import { ConnectorAddressCard } from "~/ui/connector/ConnectorAddressCard"
import { englishName, ownName } from "~/ui/media-preference/languages"
import { BROWSER } from "~/ui/media-preference/machine"
import { DISPLAY } from "~/ui/my-pages/bits"
import { AccountPage } from "./AccountPage"
import { APPS } from "./data"
import { ProfileBlock, ServicesGrid, TextButton, TitlePreview, Flag, shownLanguage, usePrefs } from "./parts"
import { CountryPicker, LanguagePicker, languageFlag } from "./pickers"
import type { PageSlug } from "./pages"

/** A titled part of a subpage. */
export function Part({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
	return (
		<section className="flex flex-col gap-3">
			<div>
				<h2 className="text-lg font-bold text-white">{title}</h2>
				{hint && <p className="max-w-prose text-sm text-gray-400">{hint}</p>}
			</div>
			{children}
		</section>
	)
}

/** The current choice, large: a flag and its name, with a line under it. */
function Current({ flag, name, line, lang }: { flag: string; name: string; line: string; lang?: string }) {
	return (
		<div className="flex items-center gap-4">
			<Flag code={flag} className="h-10 shadow-lg md:h-12" />
			<div className="min-w-0">
				<p lang={lang} className={`${DISPLAY} truncate text-3xl text-white md:text-4xl`}>
					{name}
				</p>
				<p className="text-sm text-gray-400">{line}</p>
			</div>
		</div>
	)
}

export function WhereYouWatchBody() {
	const p = usePrefs()
	return (
		<div className="flex flex-col gap-12">
			<Part title="Watching from">
				<Current flag={p.country} name={regionName(p.country)} line={`Streaming offers and age ratings for ${regionName(p.country)}`} />
				<div className="mt-2">
					<CountryPicker />
				</div>
			</Part>
			<Part title="Your services" hint="On my services keeps the titles on these, and you hear when a title you want lands on one.">
				<ServicesGrid limit={24} />
			</Part>
		</div>
	)
}

export function LanguageBody() {
	const p = usePrefs()
	const shown = shownLanguage(p.language, p.browserLanguage)
	return (
		<div className="flex flex-col gap-8">
			<div className="flex flex-col gap-4">
				<Current
					flag={languageFlag(shown)}
					name={englishName(shown)}
					lang="en"
					line={p.language === BROWSER ? `Follows your browser · ${ownName(shown)}` : ownName(shown)}
				/>
				<div className="max-w-xl">
					<TitlePreview size="sm" />
				</div>
			</div>
			<LanguagePicker />
		</div>
	)
}

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (on: boolean) => void }) {
	const id = useId()
	return (
		<div className="flex items-center gap-4 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
			<div className="min-w-0 flex-1">
				<p id={`${id}-l`} className="font-semibold text-gray-100">
					{label}
				</p>
				<p id={`${id}-h`} className="text-sm text-gray-400">
					{hint}
				</p>
			</div>
			<Switch checked={checked} onChange={onChange} labelledBy={`${id}-l`} describedBy={`${id}-h`} />
		</div>
	)
}

export function DiscoverPrivacyBody() {
	const [forYou, setForYou] = useState(true)
	const [cookies, setCookies] = useState(true)
	return (
		<div className="flex max-w-2xl flex-col gap-8">
			<Part title="Discover">
				<SwitchRow
					label="For you in Discover"
					hint="Lifts the titles that match your taste in the order you pick."
					checked={forYou}
					onChange={setForYou}
				/>
			</Part>
			<Part title="Privacy">
				<SwitchRow
					label="Cookies"
					hint={cookies ? "Allowed. See the privacy policy for what they do." : "Declined. See the privacy policy for what they do."}
					checked={cookies}
					onChange={setCookies}
				/>
			</Part>
		</div>
	)
}

function AppRow({ a }: { a: (typeof APPS)[number] }) {
	const [confirming, setConfirming] = useState(false)
	const [gone, setGone] = useState(false)
	const onComputer = a.app.returnsTo === "this computer"
	if (gone)
		return (
			<li className="flex flex-wrap items-center gap-3 p-4 text-sm text-gray-400">
				{a.app.name} is disconnected.
				<button type="button" onClick={() => setGone(false)} className="cursor-pointer font-semibold text-gray-200 underline underline-offset-4 hover:text-white">
					Prototype: bring it back
				</button>
			</li>
		)
	return (
		<li className={`p-4 ${confirming ? "bg-red-950/20" : ""}`}>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-3">
				<ConnectAppBadge app={a.app} size="sm" />
				<div className="min-w-0 flex-1 basis-40">
					<p className="font-semibold text-gray-100">
						{a.app.name}
						{onComputer && <span className="ml-2 text-sm font-normal text-gray-500">On a computer</span>}
					</p>
					<p className={`text-sm ${a.canChange ? "text-amber-300" : "text-sky-300"}`}>{a.canChange ? "Can see and change" : "Can see only"}</p>
					<p className="text-sm text-gray-500">
						Connected {a.connected} · {a.lastUsed === "Not used yet" ? a.lastUsed : `Last used ${a.lastUsed}`}
					</p>
				</div>
				{!confirming && <TextButton onClick={() => setConfirming(true)}>Disconnect</TextButton>}
			</div>
			{confirming && (
				<div role="alert" className="mt-3 flex flex-wrap items-center gap-3 border-t border-red-900/60 pt-3">
					<p className="min-w-0 flex-1 basis-56 text-sm text-red-100">
						Disconnect {a.app.name}
						{onComputer ? " on that computer" : ""}? It stops working with GoodWatch right away. Nothing you saved is lost, and you can connect it again later.
					</p>
					<button
						type="button"
						onClick={() => setGone(true)}
						className="min-h-10 cursor-pointer rounded-md border border-red-700 bg-red-900/60 px-4 text-sm font-semibold text-red-100 hover:bg-red-800"
					>
						Disconnect {a.app.name}
					</button>
					<TextButton onClick={() => setConfirming(false)}>Keep it</TextButton>
				</div>
			)}
		</li>
	)
}

export function AppsBody() {
	return (
		<div className="flex flex-col gap-4">
			<ul className="divide-y divide-gray-800 overflow-hidden rounded-xl border border-gray-700 bg-gray-800/40">
				{APPS.map((a) => (
					<AppRow key={a.id} a={a} />
				))}
			</ul>
			<ConnectorAddressCard />
		</div>
	)
}

export function ProfileBody() {
	return (
		<div className="max-w-2xl rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
			<ProfileBlock />
		</div>
	)
}

export function AccountBody() {
	return <AccountPage />
}

/** The shared body of a subpage, or null for Imports, which each variant builds. */
export function SharedBody({ slug }: { slug: PageSlug }) {
	switch (slug) {
		case "where-you-watch":
			return <WhereYouWatchBody />
		case "language":
			return <LanguageBody />
		case "discover-privacy":
			return <DiscoverPrivacyBody />
		case "connected-apps":
			return <AppsBody />
		case "profile":
			return <ProfileBody />
		case "account":
			return <AccountBody />
		default:
			return null
	}
}
