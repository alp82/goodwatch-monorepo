// Discord look-alikes for the /discord page: a chat message from the GoodWatch app with its cards, the install dialog,
// and the slash command menu. Static markup only. The cards follow what the bot sends (app/server/discord/cards.ts and
// together/cards.ts), drawn with the owner's picks from the card prototype: the backdrop title card, the member part in
// its own amber container, the /together message with match posters, and the voting card with a poster beside it.
import { whiteMark } from "~/ui/brand/white-mark"
import type { ReactNode } from "react"
import { goodwatchVibeIndex, scoreWord } from "~/utils/ratings"
import { tmdbFixedImage, tmdbImageUrl } from "~/utils/tmdb-image"

// Discord's dark theme.
const CHAT = "bg-[#313338] text-[#dbdee1]"
const CARD = "bg-[#2b2d31] ring-1 ring-[#3a3c42]"
const MUTED = "text-[#949ba4]"
const HEADING = "text-[#f2f3f5]"
const BLURPLE = "#5865f2"
const AMBER = "#f59e0b"

export interface MockTitle {
	name: string
	year: number
	score: number
	runtime: number
	genres: string[]
	service: MockService
	poster: string
	backdrop?: string
	overview?: string
}

export interface MockService {
	name: string
	logo: string
}

export const SERVICES = {
	netflix: { name: "Netflix", logo: "/rK1KljqmbvO9HQa1PBFLILWah72.png" },
	prime: { name: "Prime Video", logo: "/gMZdpavHmxFNnLpMHwVxfqeux2g.png" },
	disney: { name: "Disney+", logo: "/5eZ872CghnHFLB1j8grszbrx0dx.png" },
} satisfies Record<string, MockService>

const runtime = (minutes: number) =>
	minutes >= 60
		? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`
		: `${minutes}m`

const vibeColor = (score: number) =>
	`var(--color-vibe-${goodwatchVibeIndex(score)})`

/** The whole mock: Discord's chat background, with a caption for screen readers. */
export function DiscordWindow({
	label,
	children,
	className = "",
}: { label: string; children: ReactNode; className?: string }) {
	return (
		<figure
			className={`min-w-0 overflow-hidden rounded-xl py-4 pr-3 shadow-2xl shadow-black/40 ring-1 ring-white/10 sm:pr-4 ${CHAT} ${className}`}
		>
			<figcaption className="sr-only">{label}</figcaption>
			<div className="flex flex-col gap-4">{children}</div>
		</figure>
	)
}

/** "alp used /search": the line Discord shows above an app's answer. */
function UsedCommand({ user, command }: { user: string; command: string }) {
	return (
		<div
			className={`relative ml-[3.25rem] flex min-w-0 items-center gap-1 text-sm sm:ml-[4.5rem] ${MUTED}`}
		>
			<span
				aria-hidden="true"
				className="absolute top-[9px] -left-[1.9rem] h-3 w-6 rounded-tl-md border-t-2 border-l-2 border-[#4e5058] sm:-left-[2.4rem] sm:w-[1.9rem]"
			/>
			<span
				aria-hidden="true"
				className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#3ba55d] text-[9px] font-bold text-white"
			>
				{user[0].toUpperCase()}
			</span>
			<span className={`font-medium ${HEADING}`}>{user}</span>
			<span>used</span>
			<span className="truncate text-[#00a8fc]">{command}</span>
		</div>
	)
}

export function AppAvatar({ size = "md" }: { size?: "md" | "lg" }) {
	const box =
		size === "lg" ? "h-16 w-16 p-3" : "h-8 w-8 p-1.5 sm:h-10 sm:w-10 sm:p-2"
	return (
		<span
			aria-hidden="true"
			className={`flex shrink-0 items-center justify-center rounded-full bg-white ${box}`}
		>
			<img
				{...whiteMark()}
				alt=""
				className="h-full w-full invert"
				width={24}
				height={24}
			/>
		</span>
	)
}

/** A message from the GoodWatch app. `command` adds the "used /command" line; `ephemeral` the "Only you" note. */
export function BotMessage({
	user = "alp",
	command,
	ephemeral = false,
	children,
}: {
	user?: string
	command?: string
	ephemeral?: boolean
	children: ReactNode
}) {
	return (
		<div className="flex flex-col gap-1">
			{command && <UsedCommand user={user} command={command} />}
			<div className="flex gap-2 pl-3 sm:gap-4 sm:pl-4">
				<AppAvatar />
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<div className="flex items-center gap-1.5">
						<span className={`font-medium ${HEADING}`}>GoodWatch</span>
						<span
							className="rounded-[3px] px-1 text-[10px] leading-[15px] font-semibold tracking-wide text-white"
							style={{ background: BLURPLE }}
						>
							APP
						</span>
						<span className={`ml-1 text-xs ${MUTED}`}>Today at 21:04</span>
					</div>
					<div className="flex max-w-[560px] min-w-0 flex-col gap-2">
						{children}
					</div>
					{ephemeral && (
						<p className={`flex items-center gap-1.5 text-xs ${MUTED}`}>
							<EyeIcon />
							Only you can see this
						</p>
					)}
				</div>
			</div>
		</div>
	)
}

function EyeIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className="h-4 w-4 fill-current"
		>
			<path d="M12 5C5.6 5 2 12 2 12s3.6 7 10 7 10-7 10-7-3.6-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2.2a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z" />
		</svg>
	)
}

/** A Components V2 container, with the accent bar on its left edge. */
export function Card({
	accent,
	children,
}: { accent?: string; children: ReactNode }) {
	return (
		<div
			className={`flex min-w-0 flex-col gap-2 rounded-lg p-3 sm:p-4 ${CARD} ${accent ? "pl-4 sm:pl-5" : ""}`}
			style={accent ? { boxShadow: `inset 4px 0 0 ${accent}` } : undefined}
		>
			{children}
		</div>
	)
}

/** A section: text on the left, the poster thumbnail on the right. */
function Section({
	poster,
	alt,
	children,
}: { poster: string; alt: string; children: ReactNode }) {
	const image = tmdbFixedImage("poster", poster, 85)
	return (
		<div className="flex min-w-0 items-start gap-3">
			<div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
			<img
				{...image}
				alt={alt}
				loading="lazy"
				decoding="async"
				width={85}
				height={128}
				className="h-auto w-16 shrink-0 rounded-lg bg-[#1e1f22] sm:w-[85px]"
			/>
		</div>
	)
}

function Small({ children }: { children: ReactNode }) {
	return <p className={`text-[13px] leading-snug ${MUTED}`}>{children}</p>
}

function ScoreEmoji({ score }: { score: number }) {
	return (
		<span
			aria-hidden="true"
			className="inline-block h-[1.2em] w-[1.2em] shrink-0 rounded-[5px] align-[-0.25em] ring-1 ring-black/20 ring-inset"
			style={{ background: vibeColor(score) }}
		/>
	)
}

/** `named`: the logo stands alone, so its alt text names the service. */
function ServiceEmoji({
	service,
	named = false,
}: { service: MockService; named?: boolean }) {
	return (
		<img
			src={tmdbImageUrl(service.logo, "w92")}
			alt={named ? service.name : ""}
			loading="lazy"
			decoding="async"
			width={20}
			height={20}
			className="inline-block h-5 w-5 shrink-0 rounded-[5px]"
		/>
	)
}

/** "■ 85 · Excellent · 2026 · 2h 37m · Science Fiction, Adventure" */
function Facts({ title }: { title: MockTitle }) {
	return (
		<p className="leading-snug">
			<ScoreEmoji score={title.score} />{" "}
			<strong className={HEADING}>
				{title.score} · {scoreWord(title.score)}
			</strong>
			{"  ·  "}
			{title.year}
			{"  ·  "}
			{runtime(title.runtime)}
			{"  ·  "}
			{title.genres.join(", ")}
		</p>
	)
}

type ButtonStyle = "primary" | "secondary" | "success" | "danger" | "link"

const BUTTON_STYLES: Record<ButtonStyle, string> = {
	primary: "bg-[#5865f2] text-white",
	secondary: "bg-[#4e5058] text-white",
	success: "bg-[#248046] text-white",
	danger: "bg-[#da373c] text-white",
	link: "bg-[#4e5058] text-white",
}

/** A Discord button. It's a picture of one, so it doesn't take focus or clicks. */
export function DButton({
	style = "secondary",
	icon,
	disabled = false,
	children,
}: {
	style?: ButtonStyle
	icon?: ReactNode
	disabled?: boolean
	children: ReactNode
}) {
	return (
		<span
			className={`inline-flex h-8 min-w-[60px] items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-medium whitespace-nowrap ${BUTTON_STYLES[style]} ${disabled ? "opacity-50" : ""}`}
		>
			{icon}
			{children}
			{style === "link" && <ExternalIcon />}
		</span>
	)
}

function ExternalIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className="h-3.5 w-3.5"
			fill="none"
			stroke="currentColor"
			strokeWidth={2.4}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
		</svg>
	)
}

export function Row({ children }: { children: ReactNode }) {
	return <div className="flex flex-wrap gap-2">{children}</div>
}

/** A select menu, closed. */
function Menu({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
	return (
		<span className="flex h-10 w-full max-w-[400px] items-center justify-between gap-2 rounded-lg bg-[#1e1f22] px-3 text-sm text-[#dbdee1]">
			<span className="flex min-w-0 items-center gap-2 truncate">
				{icon}
				{children}
			</span>
			<svg
				aria-hidden="true"
				viewBox="0 0 24 24"
				className="h-[18px] w-[18px] shrink-0"
				fill="none"
				stroke="currentColor"
				strokeWidth={2.4}
			>
				<path d="m6 9 6 6 6-6" />
			</svg>
		</span>
	)
}

function Separator() {
	return <div aria-hidden="true" className="h-px bg-[#3f4147]" />
}

// ---------- cards ----------

/** The title card from /search: backdrop, title and facts beside the poster, where to watch, and the buttons. */
export function TitleCard({
	title,
	country,
	flag,
	priority = false,
}: {
	title: MockTitle
	country: string
	flag: string
	priority?: boolean
}) {
	return (
		<Card accent={vibeColor(title.score)}>
			{title.backdrop && (
				<img
					src={tmdbImageUrl(title.backdrop, "w780")}
					alt={`${title.name} backdrop`}
					loading={priority ? "eager" : "lazy"}
					{...(priority && { fetchpriority: "high" })}
					crossOrigin={priority ? "anonymous" : undefined}
					decoding="async"
					width={780}
					height={439}
					className="aspect-video h-auto w-full rounded-lg bg-[#1e1f22] object-cover"
				/>
			)}
			<Section poster={title.poster} alt={`${title.name} poster`}>
				<h3
					className={`text-xl leading-tight font-bold sm:text-2xl ${HEADING}`}
				>
					{title.name}
				</h3>
				<Facts title={title} />
				{title.overview && <p className="leading-snug">{title.overview}</p>}
			</Section>
			<Separator />
			<Small>Where to watch in {country}</Small>
			<Row>
				<DButton style="link" icon={<ServiceEmoji service={title.service} />}>
					{title.service.name}
				</DButton>
			</Row>
			<Menu icon={<span aria-hidden="true">{flag}</span>}>{country}</Menu>
			<Row>
				<DButton>Similar</DButton>
				<DButton style="link">Open on GoodWatch</DButton>
				<DButton>Share to channel</DButton>
			</Row>
		</Card>
	)
}

/** The member's part under a personal title card: only the linked member sees it. */
export function MemberBlock({
	match,
	state,
	want = false,
	seen = false,
	rated = false,
}: {
	match: number
	state: string
	want?: boolean
	seen?: boolean
	rated?: boolean
}) {
	return (
		<Card accent={AMBER}>
			<p className={`text-base font-bold ${HEADING}`}>{match}% taste match</p>
			<Small>{state}</Small>
			<Row>
				<DButton style={want ? "success" : "secondary"}>Want to see</DButton>
				<DButton style={seen ? "success" : "secondary"}>Seen</DButton>
				<DButton style={rated ? "success" : "secondary"}>Rate</DButton>
			</Row>
		</Card>
	)
}

interface TogetherRow {
	title: MockTitle
	label: string
}

/** The public /together message: who started it, the count, and each match with its poster. */
export function TogetherMessage({
	starter,
	choice,
	participants,
	stillVoting,
	country,
	rows,
}: {
	starter: string
	choice: string
	participants: number
	stillVoting: number
	country: string
	rows: TogetherRow[]
}) {
	return (
		<Card accent={AMBER}>
			<h3 className={`text-xl leading-tight font-bold ${HEADING}`}>
				Let's watch together
			</h3>
			<p>
				Started by {starter} · {choice}
			</p>
			<p>
				{participants} participants · {stillVoting} still voting
			</p>
			<Small>Where to watch in {country}</Small>
			{rows.map(({ title, label }) => (
				<Section
					key={title.name}
					poster={title.poster}
					alt={`${title.name} poster`}
				>
					<h4 className={`text-base leading-tight font-bold ${HEADING}`}>
						{title.name}
					</h4>
					<Facts title={title} />
					<p className={`font-bold ${HEADING}`}>{label}</p>
					<p className="flex items-center gap-1.5">
						<ServiceEmoji service={title.service} named />
					</p>
				</Section>
			))}
			<Menu>Pick a match</Menu>
			<Row>
				<DButton style="primary">Join</DButton>
				<DButton>End</DButton>
			</Row>
		</Card>
	)
}

/** The private voting card a person gets after pressing Join. */
export function VoteCard({
	title,
	position,
	deck,
	country,
	trailer = false,
}: {
	title: MockTitle
	position: number
	deck: number
	country: string
	trailer?: boolean
}) {
	return (
		<Card accent={AMBER}>
			<Small>
				Together · title {position} of {deck}
			</Small>
			<Section poster={title.poster} alt={`${title.name} poster`}>
				<h3 className={`text-xl leading-tight font-bold ${HEADING}`}>
					{title.name}
				</h3>
				<Facts title={title} />
				<Small>Where to watch in {country}</Small>
				<p className="flex items-center gap-1.5">
					<ServiceEmoji service={title.service} />
					<strong className={HEADING}>{title.service.name}</strong>
				</p>
			</Section>
			<Row>
				<DButton style="success">Yep</DButton>
				<DButton style="danger">Nope</DButton>
				<DButton>Undo</DButton>
				<DButton>Leave</DButton>
			</Row>
			{trailer && (
				<Row>
					<DButton style="link">Trailer</DButton>
				</Row>
			)}
		</Card>
	)
}

/** The answer to /link: what linking adds, and the button to goodwatch.app. */
export function LinkCard() {
	return (
		<Card accent={AMBER}>
			<h3 className={`text-xl leading-tight font-bold ${HEADING}`}>
				Link GoodWatch
			</h3>
			<ul className="list-disc pl-5 leading-snug">
				<li>Your taste match on every title</li>
				<li>Picks from your own services</li>
				<li>Rate, log, and save without leaving Discord</li>
			</ul>
			<Row>
				<DButton style="link">Link GoodWatch</DButton>
			</Row>
			<Small>Unlink any time with /unlink.</Small>
		</Card>
	)
}

// ---------- install dialog and slash menu ----------

function Chevron() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className={`h-5 w-5 shrink-0 ${MUTED}`}
			fill="none"
			stroke="currentColor"
			strokeWidth={2.2}
		>
			<path d="m9 6 6 6-6 6" />
		</svg>
	)
}

/** Discord's install dialog for GoodWatch, with its two choices. */
export function InstallDialog() {
	const option = (title: string, hint: string, icon: ReactNode) => (
		<div className="flex items-center gap-3 rounded-lg bg-[#2b2d31] px-3 py-3 ring-1 ring-[#3a3c42]">
			<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#4e5058] text-white">
				{icon}
			</span>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className={`font-semibold ${HEADING}`}>{title}</span>
				<span className={`text-sm ${MUTED}`}>{hint}</span>
			</span>
			<Chevron />
		</div>
	)
	return (
		<figure
			className={`mx-auto flex w-full max-w-[440px] flex-col gap-4 rounded-xl p-4 shadow-2xl shadow-black/40 ring-1 ring-white/10 sm:p-6 ${CHAT}`}
		>
			<figcaption className="sr-only">
				Discord's install dialog for GoodWatch with two choices: Add to My Apps
				and Add to Server
			</figcaption>
			<div className="flex flex-col items-center gap-2 text-center">
				<AppAvatar size="lg" />
				<p className={`text-xl font-bold ${HEADING}`}>GoodWatch</p>
				<p className={`text-sm leading-snug ${MUTED}`}>
					Your companion for Movies and Shows. Discover based on your taste,
					find a title to watch together tonight and manage your library from
					Discord.
				</p>
			</div>
			<div className="flex flex-col gap-2">
				{option(
					"Add to My Apps",
					"Use this app everywhere, including DMs",
					<PersonIcon />,
				)}
				{option("Add to Server", "Customize your server", <ServerIcon />)}
			</div>
		</figure>
	)
}

function PersonIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className="h-5 w-5 fill-current"
		>
			<path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.2-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.8-3.6-5-8-5Z" />
		</svg>
	)
}

function ServerIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className="h-5 w-5 fill-current"
		>
			<path d="M4 4h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm0 9h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Zm3-6.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm0 9a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
		</svg>
	)
}

export interface SlashCommand {
	name: string
	description: string
}

/** The command menu Discord opens when someone types / in a message. */
export function SlashMenu({ commands }: { commands: SlashCommand[] }) {
	return (
		<figure
			className={`flex w-full min-w-0 flex-col gap-2 rounded-xl p-3 shadow-2xl shadow-black/40 ring-1 ring-white/10 ${CHAT}`}
		>
			<figcaption className="sr-only">
				Discord's command menu after typing a slash, listing GoodWatch commands
			</figcaption>
			<div className="flex flex-col overflow-hidden rounded-lg bg-[#2b2d31] ring-1 ring-[#1e1f22]">
				<div
					className={`flex items-center gap-2 border-b border-[#1e1f22] px-3 py-2 text-xs font-semibold tracking-wide uppercase ${MUTED}`}
				>
					<AppAvatar />
					GoodWatch
				</div>
				<ul className="flex flex-col py-1">
					{commands.map((command, i) => (
						<li
							key={command.name}
							className={`flex min-w-0 flex-col px-3 py-1.5 sm:flex-row sm:items-baseline sm:gap-3 ${i === 0 ? "bg-[#35373c]" : ""}`}
						>
							<span className={`font-semibold ${HEADING}`}>
								/{command.name}
							</span>
							<span className={`min-w-0 truncate text-sm ${MUTED}`}>
								{command.description}
							</span>
						</li>
					))}
				</ul>
			</div>
			<div className="flex h-11 items-center gap-3 rounded-lg bg-[#383a40] px-3">
				<span
					aria-hidden="true"
					className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#b5bac1] text-lg leading-none font-bold text-[#383a40]"
				>
					+
				</span>
				<span className={HEADING}>
					/
					<span
						aria-hidden="true"
						className="ml-px inline-block h-5 w-px translate-y-1 bg-[#f2f3f5]"
					/>
				</span>
			</div>
		</figure>
	)
}
