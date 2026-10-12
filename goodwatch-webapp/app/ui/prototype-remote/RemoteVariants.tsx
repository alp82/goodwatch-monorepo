// PROTOTYPE - throwaway. "What should the Remote look like so anyone understands it at once?"
// Three variants of the Remote next to the shipped one, on the real living room (`/`), switchable via `?variant=`
// and the pill (or the [ and ] keys; the arrow keys belong to the Remote):
//   now     the shipped Remote: 17 keys, a one-line screen
// Round 2: the owner liked `big` but found its display a waste of space and of attention (the TV already shows the
// focus). Three layouts without a display, with the shipped Remote's most important keys back, all with words:
//   stack   everything: Previous / Next, OK, Back / Home / Search, the four places, the four streaming keys
//   pad     one pad (Previous, OK, Next) with Back and Home under it, then three shortcuts that say where they go
//   thumb   "Go to" shortcuts on top, "Move on the TV" at the bottom where the thumb rests
// Round 3: the owner found rounds 1 and 2 "a random mess of buttons" and the shipped Remote still the best, because
// it looks like a real remote. So these three keep the shipped body, wheel, and key material, and each follows a
// kind of remote people have held. Fewer keys, and every key's word is printed on the body under it:
//   slim    a streaming stick's remote: a large wheel, then four round keys in two columns
//   brand   a set-top box's remote: Back / Home pills, the wheel, three round keys, the streaming keys at the bottom
//   colour  a TV's remote: a readable two-line display, the wheel, three round keys, four colour keys for the places
// Round 4: `slim` is the direction. Three more of it, all a large wheel and a handful of round keys with words:
//   slim-row  the fewest keys: one row of three under a wheel 30% larger, Menu up beside the IR window
//   slim-hug  Back and Home tucked against the wheel's lower corners, Search as one pill: all within a thumb's reach
//   slim-six  slim plus two shortcuts (Mood, Watch next): how many keys before it stops being slim?
// `brand` and `colour` are off the pill too.
// Round 5: `slim-hug` wins. Five ways to put streaming keys under its Search key (Netflix, Prime Video, Disney+):
//   hug-bar    one capsule in three segments, as wide as Back to Home; each logo is its own press
//   hug-one    one key the size of Search with the three logos; each press moves to the next service, then to none
//   hug-round  three round keys in a row exactly as wide as Search
//   hug-pills  three separate pills across the body, the shipped streaming keys' look
//   hug-arc    Search becomes a round key between Back and Home, an arc under the wheel; three round keys under it
// The other slims are off the pill.
// Round 6: `hug-arc` wins. Its streaming keys are now two wide pills, Netflix and Prime Video, whose outer edges
// line up with Back and Home above. The other hugs are off the pill.
// Rounds 1 and 2 (`big`, `screen`, `jump`, `stack`, `pad`, `thumb`) are off the pill but still answer `?variant=`.
//   big     a display a third of the body tall, then Previous, Next, OK, and Back / Home / Search with words
//   screen  the Remote is a touch screen: it lists what the TV offers right now, tap one
//   jump    no arrows at all: three keys that say where they go, the rest is clicked on the TV
// Every key sends the same TV flow actions as the shipped Remote. Hidden in production builds.
import { useSearchParams } from "@remix-run/react"
import { type ReactNode, useEffect, useRef } from "react"
import {
	APP,
	ICON,
	Icon,
	Remote,
	type RemoteProps,
	Wheel,
} from "~/ui/living-room/Remote"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import disneyMark from "~/img/disneyplus-mark-160.webp"
import huluMark from "~/img/hulu-logo-120.webp"
import netflixMark from "~/img/netflix-logo.svg"
import primeMark from "~/img/primevideo-logo.svg"
import {
	REMOTE_SERVICES,
	type RemoteServiceKey,
} from "~/ui/living-room/living-room-data"
import { REMOTE_H } from "~/ui/living-room/room"
import { assetUrl } from "~/utils/asset-url"
import type { TvScreenName } from "~/ui/living-room/tv-flow"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

const VARIANTS = {
	now: "Shipped: 17 keys",
	"hug-arc": "Arc: wheel, five keys, two streaming keys",
}

export type RemoteItem = { id: string; label: string }
export type PrototypeRemoteProps = RemoteProps & {
	/** What the TV offers right now, in wheel order, with the name each one has on the Remote's screen. */
	items?: RemoteItem[]
	focused?: string | null
	/** PROTOTYPE (ui/prototype-tv-flow): the wheel's arrow keys move the focus in four directions. */
	onDirection?: (dir: "up" | "down" | "left" | "right") => void
}

export function PrototypeRemote(props: PrototypeRemoteProps) {
	const [params] = useSearchParams()
	const variant = params.get("variant")
	const { items, focused, ...shipped } = props
	if (process.env.NODE_ENV === "production") return <Remote {...shipped} />
	if (variant === "big") return <BigRemote {...props} />
	if (variant === "slim") return <SlimRemote {...props} />
	if (variant === "slim-row") return <SlimRowRemote {...props} />
	if (variant?.startsWith("hug-"))
		return <HugRemote {...props} streaming={variant.slice(4)} />
	if (variant === "slim-hug") return <SlimHugRemote {...props} />
	if (variant === "slim-six") return <SlimSixRemote {...props} />
	if (variant === "brand") return <BrandRemote {...props} />
	if (variant === "colour") return <ColourRemote {...props} />
	if (variant === "stack") return <StackRemote {...props} />
	if (variant === "pad") return <PadRemote {...props} />
	if (variant === "thumb") return <ThumbRemote {...props} />
	if (variant === "screen") return <ScreenRemote {...props} />
	if (variant === "jump") return <JumpRemote {...props} />
	return <Remote {...shipped} />
}

/** The pill. Away from the bottom centre, where the Remote is. */
export function RemoteSwitcher() {
	return (
		<PrototypeSwitcher
			variants={VARIANTS}
			keys={["[", "]"]}
			position="bottom-20 right-3 lg:bottom-6 lg:right-6"
		/>
	)
}

// ---------------------------------------------------------------------------------------------------------
// What the display says, in plain words.

const WHERE: Record<TvScreenName, string> = {
	home: "Home",
	about: "What is GoodWatch?",
	services: "Where do you watch?",
	"this-or-that": "Which one, tonight?",
	moods: "What kind of night?",
	picks: "Tonight's picks",
	title: "This title",
	search: "Search",
	quiz: "Taste quiz",
}

function describe(p: PrototypeRemoteProps) {
	const items = p.items ?? []
	const at = items.findIndex((i) => i.id === p.focused)
	const none = { at: -1, n: 0 }
	if (p.power === "off")
		return {
			...none,
			where: "The TV is off",
			title: "Press any key",
			hint: "Any key turns the TV on.",
		}
	if (p.power === "booting")
		return { ...none, where: "GoodWatch", title: "Starting…", hint: "" }
	if (p.screen.name === "search" && !p.menuOpen)
		return p.screen.query
			? {
					...none,
					where: "Search results",
					title: `"${p.screen.query}"`,
					hint: "Click a result on the TV.",
				}
			: {
					...none,
					where: "Search",
					title: p.lcd[0] === "Search" ? "Type a title…" : p.lcd[0],
					hint: "Type on your keyboard, then press OK.",
				}
	return {
		at,
		n: items.length,
		where: p.menuOpen ? "Menu" : WHERE[p.screen.name],
		title: items[at]?.label || p.lcd[0],
		hint: "Press OK to choose this.",
	}
}

// ---------------------------------------------------------------------------------------------------------
// The body all three share: the shipped shell, and the rule that the first press on a dark set only turns it on.

function Body({
	p,
	menu,
	bare,
	children,
}: {
	p: RemoteProps
	menu?: boolean
	/** No top row: the variant brings its own. */
	bare?: boolean
	children: ReactNode
}) {
	const waking = useRef(false)
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: only drops focus after pointer presses; keys need nothing
		<section
			className="relative select-none"
			aria-label="Remote control"
			onPointerDownCapture={(e) => {
				if (p.power !== "off") return
				if ((e.target as HTMLElement).closest("[data-power]")) return
				waking.current = true
				e.stopPropagation()
				p.dispatch({ type: "power", on: true })
			}}
			onClickCapture={(e) => {
				if (!waking.current) return
				waking.current = false
				e.stopPropagation()
				e.preventDefault()
			}}
			onClick={(e) => {
				if (e.detail === 0) return
				const button = (e.target as HTMLElement).closest("button")
				if (button === document.activeElement) button?.blur()
			}}
		>
			<div
				className="remote-body relative flex flex-col px-5 pb-6 pt-4"
				style={{ minHeight: REMOTE_H }}
			>
				<div className={bare ? "hidden" : "flex items-center justify-between"}>
					<button
						type="button"
						data-power
						onClick={() =>
							p.dispatch({ type: "power", on: p.power === "off" })
						}
						className="remote-key flex h-10 items-center gap-2 rounded-full px-4 text-[16px] font-semibold text-rose-300"
					>
						<Icon d={ICON.power} className="h-4 w-4" />
						{p.power === "off" ? "Turn on" : "Turn off"}
					</button>
					{menu ? (
						<button
							type="button"
							aria-pressed={p.menuOpen}
							onClick={() => p.dispatch({ type: "toggle-menu" })}
							className="remote-key flex h-10 items-center gap-2 rounded-full px-4 text-[16px] font-semibold"
						>
							<Icon d="M4 7h16M4 12h16M4 17h16" className="h-4 w-4" />
							Menu
						</button>
					) : (
						<div
							className="mr-2 h-2 w-16 rounded-full bg-black/70"
							aria-hidden
						/>
					)}
				</div>
				{children}
			</div>
		</section>
	)
}

/** A key with its word under (or beside) its icon. */
function WordKey({
	d,
	label,
	pressed,
	onClick,
	className = "h-[72px]",
}: {
	d: string
	label: string
	pressed?: boolean
	onClick: () => void
	className?: string
}) {
	return (
		<button
			type="button"
			aria-pressed={pressed}
			onClick={onClick}
			className={`remote-key flex w-full flex-col items-center justify-center gap-1.5 rounded-[20px] text-[18px] font-semibold leading-none ${className}`}
		>
			<Icon d={d} className="h-6 w-6" />
			{label}
		</button>
	)
}

// ---------------------------------------------------------------------------------------------------------
// big: one large display and seven keys. The wheel's four arrows were two moves all along (up and left go to the
// previous item, down and right to the next), so two keys say so.

function BigRemote(p: PrototypeRemoteProps) {
	const d = describe(p)
	return (
		<Body p={p}>
			<div className="mt-4 flex flex-col gap-3">
				<div className="remote-lcd relative flex h-[272px] flex-col overflow-hidden rounded-[20px] px-5 py-4 text-[var(--lcd)]">
					<div className="flex items-baseline justify-between text-[16px] font-semibold uppercase tracking-[0.1em] opacity-80">
						<span className="truncate">{d.where}</span>
						{d.n > 1 && (
							<span className="shrink-0 pl-2">
								{d.at + 1} of {d.n}
							</span>
						)}
					</div>
					<div
						className="lcd-font mt-3 line-clamp-3 flex-1 text-[46px] leading-[0.92]"
						aria-live="polite"
					>
						{d.title}
					</div>
					{d.n > 1 && d.n <= 14 && (
						<div className="mb-2 flex gap-1.5" aria-hidden>
							{(p.items ?? []).map((item, i) => (
								<span
									key={item.id}
									className="h-2 flex-1 rounded-full bg-[var(--lcd)]"
									style={{ opacity: i === d.at ? 1 : 0.22 }}
								/>
							))}
						</div>
					)}
					<div className="text-[19px] leading-tight opacity-95">{d.hint}</div>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<WordKey
						d="M15 5l-7 7 7 7"
						label="Previous"
						className="h-[88px]"
						onClick={() => p.dispatch({ type: "step", by: -1 })}
					/>
					<WordKey
						d="M9 5l7 7-7 7"
						label="Next"
						className="h-[88px]"
						onClick={() => p.dispatch({ type: "step", by: 1 })}
					/>
				</div>
				<button
					type="button"
					onClick={p.onOk}
					className="remote-key h-[88px] w-full rounded-[22px] text-[32px] font-bold tracking-wide"
					style={{
						background: "linear-gradient(180deg, #fbbf24, #d97706)",
						color: "#1c1304",
					}}
				>
					OK
				</button>
				<div className="grid grid-cols-3 gap-3">
					<WordKey
						d={ICON.back}
						label="Back"
						onClick={() => p.dispatch({ type: "back" })}
					/>
					<WordKey
						d={ICON.home}
						label="Home"
						onClick={() => p.dispatch({ type: "home" })}
					/>
					<WordKey
						d={ICON.search}
						label="Search"
						pressed={p.screen.name === "search"}
						onClick={() => p.dispatch({ type: "open-search" })}
					/>
				</div>
			</div>
		</Body>
	)
}

// ---------------------------------------------------------------------------------------------------------
// screen: the Remote is its display. It lists what the TV offers right now; tapping a row chooses it. No arrows
// and no OK. Four tabs with words sit at the bottom of the glass.

function ScreenRemote(p: PrototypeRemoteProps) {
	const d = describe(p)
	const items = p.items ?? []
	const list = useRef<HTMLDivElement>(null)
	// Keep the focused row in view when the keyboard or the TV moves the focus.
	useEffect(() => {
		const box = list.current
		const row = box?.querySelector<HTMLElement>(
			`[data-row="${CSS.escape(p.focused ?? "")}"]`,
		)
		if (!box || !row) return
		if (row.offsetTop < box.scrollTop) box.scrollTop = row.offsetTop
		else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight)
			box.scrollTop = row.offsetTop + row.offsetHeight - box.clientHeight
	}, [p.focused])
	const searching = p.screen.name === "search" && !p.menuOpen
	const big =
		"mt-5 h-16 w-full rounded-[18px] bg-[var(--lcd)] text-[20px] font-bold text-black [text-shadow:none] active:scale-[0.98]"
	return (
		<Body p={p}>
			<div className="remote-lcd mt-4 flex h-[590px] flex-col overflow-hidden rounded-[22px] text-[var(--lcd)]">
				<div className="px-4 pb-3 pt-4">
					<div className="text-[16px] font-semibold uppercase tracking-[0.1em] opacity-80">
						{p.power === "on" && items.length
							? "Tap what you want"
							: "GoodWatch"}
					</div>
					<div className="lcd-font mt-1 truncate text-[34px] leading-none">
						{d.where}
					</div>
				</div>
				{p.power !== "on" || searching || !items.length ? (
					<div className="flex flex-1 flex-col px-4 pt-6">
						<div
							className="lcd-font line-clamp-3 text-[44px] leading-[0.92]"
							aria-live="polite"
						>
							{d.title}
						</div>
						<div className="mt-3 text-[19px] leading-tight opacity-95">
							{d.hint.replace("press OK", "tap Search")}
						</div>
						{p.power === "off" && (
							<button type="button" className={big}>
								Turn on
							</button>
						)}
						{p.power === "on" && searching && (
							<button
								type="button"
								className={big}
								onClick={
									p.screen.name === "search" && p.screen.query
										? () => p.dispatch({ type: "open-search" })
										: p.onOk
								}
							>
								{p.screen.name === "search" && p.screen.query
									? "New search"
									: "Search"}
							</button>
						)}
					</div>
				) : (
					<div
						ref={list}
						className="relative flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3"
					>
						{items.map((item) => {
							const on = item.id === p.focused
							return (
								<button
									key={item.id}
									type="button"
									data-row={item.id}
									aria-current={on}
									onClick={() => p.dispatch({ type: "choose", item: item.id })}
									onPointerEnter={(e) => {
										if (e.pointerType === "mouse")
											p.dispatch({ type: "focus", item: item.id })
									}}
									className={`flex min-h-[56px] shrink-0 items-center justify-between gap-3 rounded-[16px] px-4 text-left text-[21px] font-semibold leading-tight transition-colors ${on ? "bg-[var(--lcd)] text-black [text-shadow:none]" : "bg-white/[0.06]"}`}
								>
									<span>{item.label}</span>
									<Icon d="M9 5l7 7-7 7" className="h-5 w-5 shrink-0" />
								</button>
							)
						})}
					</div>
				)}
				<div className="grid grid-cols-4 border-t border-[var(--lcd)]/25 [text-shadow:none]">
					{(
						[
							["Back", ICON.back, { type: "back" }, false],
							["Home", ICON.home, { type: "home" }, false],
							[
								"Search",
								ICON.search,
								{ type: "open-search" },
								p.screen.name === "search",
							],
							["Menu", ICON.more, { type: "toggle-menu" }, p.menuOpen],
						] as const
					).map(([label, icon, action, on]) => (
						<button
							key={label}
							type="button"
							aria-pressed={on}
							onClick={() => p.dispatch(action)}
							className={`flex h-[68px] flex-col items-center justify-center gap-1 text-[16px] font-semibold hover:bg-white/10 ${on ? "bg-white/10" : "opacity-80"}`}
						>
							<Icon d={icon} className="h-6 w-6" />
							{label}
						</button>
					))}
				</div>
			</div>
		</Body>
	)
}

// ---------------------------------------------------------------------------------------------------------
// jump: no arrows and no OK. Three keys say in words where they go; everything else is clicked on the TV. The
// display says where you are.

function JumpRemote(p: PrototypeRemoteProps) {
	const d = describe(p)
	const typing = p.screen.name === "search" && !p.screen.query
	const jumps = [
		{
			d: ICON.mood,
			tint: "#fbbf24",
			title: "Tonight",
			sub: "Pick by mood",
			on: p.screen.name === "moods",
			run: () => p.dispatch({ type: "open-moods" }),
		},
		{
			d: ICON.search,
			tint: "#34d399",
			title: typing ? "Search now" : "Search",
			sub: typing ? "Find what you typed" : "Find a movie or show",
			on: p.screen.name === "search",
			run: typing ? p.onOk : () => p.dispatch({ type: "open-search" }),
		},
		{
			d: APP["watch-next"].d,
			tint: APP["watch-next"].tint,
			title: "Watch next",
			sub: "From your Wishlist",
			on: false,
			run: () => p.dispatch({ type: "open-app", app: "watch-next" }),
		},
	]
	return (
		<Body p={p}>
			<div className="mt-4 flex flex-col gap-3">
				<div className="remote-lcd flex h-[190px] flex-col overflow-hidden rounded-[20px] px-5 py-4 text-[var(--lcd)]">
					<div className="text-[16px] font-semibold uppercase tracking-[0.1em] opacity-80">
						{p.power === "on" ? "On the TV now" : "GoodWatch"}
					</div>
					<div
						className="lcd-font mt-2 line-clamp-2 flex-1 text-[42px] leading-[0.92]"
						aria-live="polite"
					>
						{p.power === "on" && p.screen.name !== "search" ? d.where : d.title}
					</div>
					<div className="text-[19px] leading-tight opacity-95">
						{p.power === "off"
							? d.hint
							: typing
								? "Type on your keyboard, then Search now."
								: "Click anything on the TV, or press a key."}
					</div>
				</div>
				{jumps.map((j) => (
					<button
						key={j.title}
						type="button"
						aria-pressed={j.on}
						onClick={j.run}
						className="remote-key flex h-[88px] w-full items-center gap-4 rounded-[22px] px-4 text-left"
					>
						<span
							className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black/35"
							style={{ color: j.tint }}
						>
							<Icon d={j.d} className="h-7 w-7" />
						</span>
						<span>
							<span className="block text-[24px] font-bold leading-tight text-white">
								{j.title}
							</span>
							<span className="block text-[17px] leading-tight opacity-80">{j.sub}</span>
						</span>
					</button>
				))}
				<div className="grid grid-cols-2 gap-3">
					<WordKey
						d={ICON.back}
						label="Back"
						onClick={() => p.dispatch({ type: "back" })}
					/>
					<WordKey
						d={ICON.home}
						label="Home"
						onClick={() => p.dispatch({ type: "home" })}
					/>
				</div>
			</div>
		</Body>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Round 2: no display. The pieces the three layouts share are keys, never a layout.

const OK_STYLE = {
	background: "linear-gradient(180deg, #fbbf24, #d97706)",
	color: "#1c1304",
}
const PREV = "M15 5l-7 7 7 7"
const NEXT = "M9 5l7 7-7 7"

type Place = "mood" | "watch-next" | "explorer" | "taste"
const PLACES: Place[] = ["mood", "watch-next", "explorer", "taste"]

function placeKey(p: PrototypeRemoteProps, place: Place) {
	return {
		d: place === "mood" ? ICON.mood : APP[place].d,
		label: place === "mood" ? "Mood" : APP[place].name,
		pressed: place === "mood" && p.screen.name === "moods",
		onClick: () =>
			p.dispatch(
				place === "mood"
					? { type: "open-moods" }
					: { type: "open-app", app: place },
			),
	}
}

function Caption({ children }: { children: ReactNode }) {
	return (
		<div className="px-1 text-[14px] font-semibold uppercase tracking-[0.14em] text-white/45">
			{children}
		</div>
	)
}

const BRAND: Record<RemoteServiceKey, { src: string; ink: string; w: string }> =
	{
		netflix: { src: netflixMark, ink: "#e50914", w: "70%" },
		prime: { src: primeMark, ink: "#ffffff", w: "72%" },
		disney: { src: disneyMark, ink: "#ffffff", w: "56%" },
		hulu: { src: huluMark, ink: "#1ce783", w: "60%" },
	}

function ServiceKeys({ p }: { p: PrototypeRemoteProps }) {
	return (
		<div className="grid grid-cols-4 gap-2">
			{REMOTE_SERVICES.map(({ key }) => {
				const name = p.serviceName(key)
				const b = BRAND[key]
				const mask = `url("${assetUrl(b.src)}") center / contain no-repeat`
				return (
					<button
						key={key}
						type="button"
						aria-pressed={p.activeService === name}
						aria-label={`Only ${name}`}
						title={`Only ${name}`}
						onClick={() => p.dispatch({ type: "service-key", service: name })}
						className="remote-key remote-service flex h-11 items-center justify-center rounded-full"
					>
						<span
							aria-hidden
							className="block h-[46%]"
							style={{ width: b.w, background: b.ink, WebkitMask: mask, mask }}
						/>
					</button>
				)
			})}
		</div>
	)
}

// stack: every important key of the shipped Remote, top to bottom in the order you use them.
function StackRemote(p: PrototypeRemoteProps) {
	return (
		<Body p={p} menu>
			<div className="mt-4 flex flex-col gap-3">
				<div className="grid grid-cols-2 gap-3">
					<WordKey
						d={PREV}
						label="Previous"
						className="h-[80px]"
						onClick={() => p.dispatch({ type: "step", by: -1 })}
					/>
					<WordKey
						d={NEXT}
						label="Next"
						className="h-[80px]"
						onClick={() => p.dispatch({ type: "step", by: 1 })}
					/>
				</div>
				<button
					type="button"
					onClick={p.onOk}
					className="remote-key h-[80px] w-full rounded-[22px] text-[32px] font-bold tracking-wide"
					style={OK_STYLE}
				>
					OK
				</button>
				<div className="grid grid-cols-3 gap-3">
					<WordKey
						d={ICON.back}
						label="Back"
						onClick={() => p.dispatch({ type: "back" })}
					/>
					<WordKey
						d={ICON.home}
						label="Home"
						onClick={() => p.dispatch({ type: "home" })}
					/>
					<WordKey
						d={ICON.search}
						label="Search"
						pressed={p.screen.name === "search"}
						onClick={() => p.dispatch({ type: "open-search" })}
					/>
				</div>
				<div className="remote-well mt-1 grid grid-cols-2 gap-2 rounded-[26px] p-2">
					{PLACES.map((place) => (
						<WordKey key={place} {...placeKey(p, place)} className="h-[68px]" />
					))}
				</div>
				<div className="mt-1">
					<ServiceKeys p={p} />
				</div>
			</div>
		</Body>
	)
}

// pad: moving and choosing are one object, a capsule with a round OK in its middle. Back and Home hang under it.
// Three shortcuts follow as full-width keys with a line that says where each one goes.
function PadRemote(p: PrototypeRemoteProps) {
	const half =
		"remote-arrow flex h-full flex-1 flex-col justify-center gap-1.5 text-[16px] font-semibold leading-none text-white/80 hover:text-white active:scale-95"
	const shortcuts = [
		{
			...placeKey(p, "mood"),
			label: "Mood",
			sub: "Pick by how you feel",
			tint: "#fbbf24",
		},
		{
			d: ICON.search,
			label: "Search",
			sub: "Find a movie or show",
			tint: "#34d399",
			pressed: p.screen.name === "search",
			onClick: () => p.dispatch({ type: "open-search" }),
		},
		{
			...placeKey(p, "watch-next"),
			sub: "From your Wishlist",
			tint: APP["watch-next"].tint,
		},
	]
	return (
		<Body p={p} menu>
			<div className="mt-5 flex flex-col gap-3">
				<div className="remote-wheel relative flex h-[132px] cursor-default items-stretch rounded-full">
					<div className="remote-face pointer-events-none absolute inset-[8px] rounded-full" />
					<button
						type="button"
						onClick={() => p.dispatch({ type: "step", by: -1 })}
						className={`${half} relative items-start rounded-l-full pl-4`}
					>
						<Icon d={PREV} className="h-7 w-7" />
						Previous
					</button>
					<button
						type="button"
						onClick={() => p.dispatch({ type: "step", by: 1 })}
						className={`${half} relative items-end rounded-r-full pr-4`}
					>
						<Icon d={NEXT} className="h-7 w-7" />
						Next
					</button>
					<button
						type="button"
						onClick={p.onOk}
						className="remote-key absolute left-1/2 top-1/2 h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 rounded-full text-[30px] font-bold hover:-translate-y-1/2 active:-translate-y-1/2 active:scale-95"
						style={OK_STYLE}
					>
						OK
					</button>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<WordKey
						d={ICON.back}
						label="Back"
						className="h-[72px] rounded-full"
						onClick={() => p.dispatch({ type: "back" })}
					/>
					<WordKey
						d={ICON.home}
						label="Home"
						className="h-[72px] rounded-full"
						onClick={() => p.dispatch({ type: "home" })}
					/>
				</div>
				<div className="mt-2 flex flex-col gap-2.5">
					{shortcuts.map((k) => (
						<button
							key={k.label}
							type="button"
							aria-pressed={k.pressed}
							onClick={k.onClick}
							className="remote-key flex h-[76px] w-full items-center gap-4 rounded-[22px] px-4 text-left"
						>
							<span
								className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/35"
								style={{ color: k.tint }}
							>
								<Icon d={k.d} className="h-6 w-6" />
							</span>
							<span>
								<span className="block text-[22px] font-bold leading-tight text-white">
									{k.label}
								</span>
								<span className="block text-[16px] leading-tight opacity-75">
									{k.sub}
								</span>
							</span>
						</button>
					))}
				</div>
			</div>
		</Body>
	)
}

// thumb: two named zones. Shortcuts sit on top; the keys pressed again and again sit low, where the thumb rests
// in the hand photo.
function ThumbRemote(p: PrototypeRemoteProps) {
	return (
		<Body p={p} menu>
			<div className="mt-5 flex flex-col gap-2.5">
				<Caption>Go to</Caption>
				<button
					type="button"
					aria-pressed={p.screen.name === "search"}
					onClick={() => p.dispatch({ type: "open-search" })}
					className="remote-key flex h-[60px] w-full items-center justify-center gap-3 rounded-full text-[20px] font-semibold"
				>
					<Icon d={ICON.search} className="h-6 w-6" />
					Search
				</button>
				<div className="grid grid-cols-2 gap-2.5">
					{PLACES.map((place) => (
						<WordKey key={place} {...placeKey(p, place)} className="h-[70px]" />
					))}
				</div>
				<div className="mt-4">
					<Caption>Move on the TV</Caption>
				</div>
				<div className="remote-well grid grid-cols-[1fr_1.25fr_1fr] gap-2 rounded-[28px] p-2">
					<WordKey
						d={PREV}
						label="Previous"
						className="h-[104px] !text-[16px]"
						onClick={() => p.dispatch({ type: "step", by: -1 })}
					/>
					<button
						type="button"
						onClick={p.onOk}
						className="remote-key h-[104px] w-full rounded-[20px] text-[32px] font-bold"
						style={OK_STYLE}
					>
						OK
					</button>
					<WordKey
						d={NEXT}
						label="Next"
						className="h-[104px] !text-[16px]"
						onClick={() => p.dispatch({ type: "step", by: 1 })}
					/>
				</div>
				<div className="grid grid-cols-2 gap-2.5">
					<WordKey
						d={ICON.back}
						label="Back"
						onClick={() => p.dispatch({ type: "back" })}
					/>
					<WordKey
						d={ICON.home}
						label="Home"
						onClick={() => p.dispatch({ type: "home" })}
					/>
				</div>
			</div>
		</Body>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Round 3: real remotes. The shipped wheel and key material; words are printed on the body under the keys.

const MENU_ICON = "M4 7h16M4 12h16M4 17h16"

/** The shipped top row: a round red power key, the IR window, and the Menu key where a variant has one. */
function TopRow({ p, menu }: { p: RemoteProps; menu?: boolean }) {
	return (
		<div className="flex w-full items-center justify-between">
			<button
				type="button"
				data-power
				aria-label={p.power === "off" ? "Turn on" : "Turn off"}
				onClick={() => p.dispatch({ type: "power", on: p.power === "off" })}
				className="remote-key flex h-11 w-11 items-center justify-center rounded-full text-rose-400"
			>
				<Icon d={ICON.power} className="h-5 w-5" />
			</button>
			<div className="h-2 w-20 rounded-full bg-black/70" aria-hidden />
			{menu ? (
				<button
					type="button"
					aria-label="Menu"
					title="Menu"
					aria-pressed={p.menuOpen}
					onClick={() => p.dispatch({ type: "toggle-menu" })}
					className="remote-key flex h-11 w-11 items-center justify-center rounded-full"
				>
					<Icon d={MENU_ICON} className="h-5 w-5" />
				</button>
			) : (
				<div className="w-11" />
			)}
		</div>
	)
}

/** A round key with its word printed under it. */
function RoundKey({
	d,
	label,
	pressed,
	onClick,
	size = "h-[58px] w-[58px]",
}: {
	d: string
	label: string
	pressed?: boolean
	onClick: () => void
	size?: string
}) {
	return (
		<button
			type="button"
			aria-pressed={pressed}
			onClick={onClick}
			className="flex flex-col items-center gap-2 rounded-[18px]"
		>
			<span
				aria-pressed={pressed}
				className={`remote-key flex items-center justify-center rounded-full ${size}`}
			>
				<Icon d={d} className="h-[42%] w-[42%]" />
			</span>
			<span className="w-[76px] text-center text-[13px] font-semibold uppercase leading-tight tracking-[0.1em] text-white/60">
				{label}
			</span>
		</button>
	)
}

const BRAND_2COL: Record<RemoteServiceKey, string> = {
	netflix: "48%",
	prime: "50%",
	disney: "38%",
	hulu: "40%",
}

function Logo() {
	return (
		<img
			src={assetUrl(gwLogo)}
			alt=""
			className="absolute bottom-8 left-1/2 h-7 -translate-x-1/2 opacity-20"
		/>
	)
}

// slim: a streaming stick's remote. The wheel is a fifth larger, and only four round keys follow.
function SlimRemote(p: PrototypeRemoteProps) {
	return (
		<Body p={p} bare>
			<TopRow p={p} />
			<div className="mt-10 flex flex-col items-center">
				<div className="flex h-[236px] w-[236px] items-center justify-center">
					<div style={{ transform: "scale(1.2)" }}>
						<Wheel dispatch={p.dispatch} onOk={p.onOk} />
					</div>
				</div>
				<div className="mt-9 grid grid-cols-2 gap-x-14 gap-y-6">
					<RoundKey
						d={ICON.back}
						label="Back"
						size="h-[68px] w-[68px]"
						onClick={() => p.dispatch({ type: "back" })}
					/>
					<RoundKey
						d={ICON.home}
						label="Home"
						size="h-[68px] w-[68px]"
						onClick={() => p.dispatch({ type: "home" })}
					/>
					<RoundKey
						d={ICON.search}
						label="Search"
						size="h-[68px] w-[68px]"
						pressed={p.screen.name === "search"}
						onClick={() => p.dispatch({ type: "open-search" })}
					/>
					<RoundKey
						d={MENU_ICON}
						label="Menu"
						size="h-[68px] w-[68px]"
						pressed={p.menuOpen}
						onClick={() => p.dispatch({ type: "toggle-menu" })}
					/>
				</div>
			</div>
			<Logo />
		</Body>
	)
}

// brand: a set-top box's remote. Back and Home sit above the wheel as pills, three shortcuts under it, and the
// streaming keys low on the body as on the shipped Remote.
function BrandRemote(p: PrototypeRemoteProps) {
	const pill =
		"remote-key flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[13px] font-semibold uppercase tracking-wider"
	return (
		<Body p={p} bare>
			<TopRow p={p} menu />
			<div className="mt-6 flex h-[600px] flex-col items-center">
				<div className="flex w-full gap-3">
					<button
						type="button"
						className={pill}
						onClick={() => p.dispatch({ type: "back" })}
					>
						<Icon d={ICON.back} className="h-5 w-5" />
						Back
					</button>
					<button
						type="button"
						className={pill}
						onClick={() => p.dispatch({ type: "home" })}
					>
						<Icon d={ICON.home} className="h-5 w-5" />
						Home
					</button>
				</div>
				<div className="mt-6">
					<Wheel dispatch={p.dispatch} onOk={p.onOk} />
				</div>
				<div className="mt-7 flex w-full justify-between px-2">
					<RoundKey
						d={ICON.search}
						label="Search"
						pressed={p.screen.name === "search"}
						onClick={() => p.dispatch({ type: "open-search" })}
					/>
					<RoundKey {...placeKey(p, "mood")} />
					<RoundKey {...placeKey(p, "watch-next")} />
				</div>
				<div className="flex-1" />
				<div className="grid w-full grid-cols-2 gap-2 px-2">
					{REMOTE_SERVICES.map(({ key }) => {
						const name = p.serviceName(key)
						const mask = `url("${assetUrl(BRAND[key].src)}") center / contain no-repeat`
						return (
							<button
								key={key}
								type="button"
								aria-pressed={p.activeService === name}
								aria-label={`Only ${name}`}
								title={`Only ${name}`}
								onClick={() =>
									p.dispatch({ type: "service-key", service: name })
								}
								className="remote-key remote-service flex h-10 items-center justify-center rounded-full"
							>
								<span
									aria-hidden
									className="block h-[52%]"
									style={{
										width: BRAND_2COL[key],
										background: BRAND[key].ink,
										WebkitMask: mask,
										mask,
									}}
								/>
							</button>
						)
					})}
				</div>
			</div>
			<Logo />
		</Body>
	)
}

// colour: a TV's remote. The shipped display grows to two readable lines, and the four places become the four
// colour keys every TV remote has, each with its name printed under it.
function ColourRemote(p: PrototypeRemoteProps) {
	const [head, line] = p.lcd
	const tint: Record<Place, string> = {
		mood: "#fbbf24",
		"watch-next": APP["watch-next"].tint,
		explorer: APP.explorer.tint,
		taste: APP.taste.tint,
	}
	return (
		<Body p={p} bare>
			<TopRow p={p} menu />
			<div className="mt-5 flex flex-col items-center">
				<div className="remote-lcd relative flex h-[108px] w-full flex-col justify-between overflow-hidden rounded-[16px] px-4 py-3">
					<div
						className="lcd-font line-clamp-2 text-[28px] leading-[0.95] text-[var(--lcd)]"
						aria-live="polite"
					>
						{head}
					</div>
					<div className="truncate text-[15px] text-[var(--lcd)] opacity-85">
						{line}
					</div>
					<div className="pointer-events-none absolute inset-0 rounded-[16px] bg-[linear-gradient(160deg,rgba(255,255,255,0.10)_0%,transparent_35%)]" />
				</div>
				<div className="mt-6">
					<Wheel dispatch={p.dispatch} onOk={p.onOk} />
				</div>
				<div className="mt-7 flex w-full justify-between px-2">
					<RoundKey
						d={ICON.back}
						label="Back"
						onClick={() => p.dispatch({ type: "back" })}
					/>
					<RoundKey
						d={ICON.home}
						label="Home"
						onClick={() => p.dispatch({ type: "home" })}
					/>
					<RoundKey
						d={ICON.search}
						label="Search"
						pressed={p.screen.name === "search"}
						onClick={() => p.dispatch({ type: "open-search" })}
					/>
				</div>
				<div className="mt-8 grid w-full grid-cols-4 gap-2">
					{PLACES.map((place) => {
						const k = placeKey(p, place)
						return (
							<button
								key={place}
								type="button"
								aria-pressed={k.pressed}
								onClick={k.onClick}
								className="flex flex-col items-center gap-2"
							>
								<span
									aria-pressed={k.pressed}
									className="remote-key block h-7 w-full rounded-full"
									style={{
										background: `linear-gradient(180deg, ${tint[place]}, color-mix(in srgb, ${tint[place]} 65%, #000))`,
									}}
								/>
								<span className="text-[13px] font-semibold leading-tight text-white/65">
									{k.label}
								</span>
							</button>
						)
					})}
				</div>
			</div>
			<Logo />
		</Body>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Round 4: more of slim.

/** The shipped wheel, `k` times its size. */
function BigWheel({ p, k }: { p: PrototypeRemoteProps; k: number }) {
	return (
		<div
			className="flex shrink-0 items-center justify-center"
			style={{ width: 196 * k, height: 196 * k }}
		>
			<div style={{ transform: `scale(${k})` }}>
				<Wheel
					dispatch={p.dispatch}
					onOk={p.onOk}
					onDirection={p.onDirection}
				/>
			</div>
		</div>
	)
}

function slimKeys(p: PrototypeRemoteProps) {
	return {
		back: {
			d: ICON.back,
			label: "Back",
			onClick: () => p.dispatch({ type: "back" }),
		},
		home: {
			d: ICON.home,
			label: "Home",
			onClick: () => p.dispatch({ type: "home" }),
		},
		search: {
			d: ICON.search,
			label: "Search",
			pressed: p.screen.name === "search",
			onClick: () => p.dispatch({ type: "open-search" }),
		},
		menu: {
			d: MENU_ICON,
			label: "Menu",
			pressed: p.menuOpen,
			onClick: () => p.dispatch({ type: "toggle-menu" }),
		},
	}
}

function SlimRowRemote(p: PrototypeRemoteProps) {
	const k = slimKeys(p)
	return (
		<Body p={p} bare>
			<TopRow p={p} menu />
			<div className="mt-12 flex flex-col items-center">
				<BigWheel p={p} k={1.3} />
				<div className="mt-11 flex w-full justify-between">
					<RoundKey {...k.back} size="h-[68px] w-[68px]" />
					<RoundKey {...k.home} size="h-[68px] w-[68px]" />
					<RoundKey {...k.search} size="h-[68px] w-[68px]" />
				</div>
			</div>
			<Logo />
		</Body>
	)
}

function SlimHugRemote(p: PrototypeRemoteProps) {
	const k = slimKeys(p)
	return (
		<Body p={p} bare>
			<TopRow p={p} menu />
			<div className="relative mt-10 h-[322px] w-full">
				<div className="absolute left-1/2 top-0 -translate-x-1/2">
					<BigWheel p={p} k={1.2} />
				</div>
				<div className="absolute left-0 top-[216px]">
					<RoundKey {...k.back} size="h-[62px] w-[62px]" />
				</div>
				<div className="absolute right-0 top-[216px]">
					<RoundKey {...k.home} size="h-[62px] w-[62px]" />
				</div>
			</div>
			<button
				type="button"
				aria-pressed={k.search.pressed}
				onClick={k.search.onClick}
				className="remote-key mx-auto mt-5 flex h-[54px] w-[190px] items-center justify-center gap-2.5 rounded-full text-[14px] font-semibold uppercase tracking-[0.12em]"
			>
				<Icon d={ICON.search} className="h-5 w-5" />
				Search
			</button>
			<Logo />
		</Body>
	)
}

function SlimSixRemote(p: PrototypeRemoteProps) {
	const k = slimKeys(p)
	const size = "h-[62px] w-[62px]"
	return (
		<Body p={p} bare>
			<TopRow p={p} />
			<div className="mt-8 flex flex-col items-center">
				<BigWheel p={p} k={1.2} />
				<div className="mt-7 grid grid-cols-2 gap-x-14 gap-y-4">
					<RoundKey {...k.back} size={size} />
					<RoundKey {...k.home} size={size} />
					<RoundKey {...k.search} size={size} />
					<RoundKey {...k.menu} size={size} />
					<RoundKey {...placeKey(p, "mood")} size={size} />
					<RoundKey {...placeKey(p, "watch-next")} size={size} />
				</div>
			</div>
			<Logo />
		</Body>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Round 5: slim-hug with streaming keys under Search.

const HUG_SERVICES = REMOTE_SERVICES.slice(0, 3)
/** How wide each logo is next to the others at the same height. */
const LOGO_W: Record<RemoteServiceKey, number> = {
	netflix: 1,
	prime: 1.04,
	disney: 0.8,
	hulu: 0.84,
}

function ServiceLogo({
	k,
	w,
	dim,
}: { k: RemoteServiceKey; w: number; dim?: boolean }) {
	const mask = `url("${assetUrl(BRAND[k].src)}") center / contain no-repeat`
	return (
		<span
			aria-hidden
			className="block shrink-0 transition-opacity"
			style={{
				width: w * LOGO_W[k],
				height: w * 0.42,
				background: BRAND[k].ink,
				WebkitMask: mask,
				mask,
				opacity: dim ? 0.3 : 1,
			}}
		/>
	)
}

export function HugRemote({
	streaming,
	...p
}: PrototypeRemoteProps & { streaming: string }) {
	const k = slimKeys(p)
	const arc = streaming === "arc"
	const services = HUG_SERVICES.map(({ key }) => {
		const name = p.serviceName(key)
		return {
			key,
			name,
			on: p.activeService === name,
			press: () => p.dispatch({ type: "service-key", service: name }),
		}
	})
	const at = services.findIndex((s) => s.on)
	const round = (
		<div className="mx-auto flex w-[190px] justify-between">
			{services.map((s) => (
				<button
					key={s.key}
					type="button"
					aria-pressed={s.on}
					aria-label={`Only ${s.name}`}
					title={`Only ${s.name}`}
					onClick={s.press}
					className="remote-key remote-service flex h-[58px] w-[58px] items-center justify-center rounded-full"
				>
					<ServiceLogo k={s.key} w={40} />
				</button>
			))}
		</div>
	)
	return (
		<Body p={p} bare>
			<TopRow p={p} menu />
			<div
				className={`relative mt-10 w-full ${arc ? "h-[346px]" : "h-[322px]"}`}
			>
				<div className="absolute left-1/2 top-0 -translate-x-1/2">
					<BigWheel p={p} k={1.2} />
				</div>
				<div className="absolute left-0 top-[216px]">
					<RoundKey {...k.back} size="h-[62px] w-[62px]" />
				</div>
				<div className="absolute right-0 top-[216px]">
					<RoundKey {...k.home} size="h-[62px] w-[62px]" />
				</div>
				{arc && (
					<div className="absolute left-1/2 top-[252px] -translate-x-1/2">
						<RoundKey {...k.search} size="h-[62px] w-[62px]" />
					</div>
				)}
			</div>
			{!arc && (
				<button
					type="button"
					aria-pressed={k.search.pressed}
					onClick={k.search.onClick}
					className="remote-key mx-auto mt-5 flex h-[54px] w-[190px] items-center justify-center gap-2.5 rounded-full text-[14px] font-semibold uppercase tracking-[0.12em]"
				>
					<Icon d={ICON.search} className="h-5 w-5" />
					Search
				</button>
			)}
			<div className={arc ? "mt-6" : "mt-4"}>
				{streaming === "bar" && (
					<div className="remote-key flex h-[52px] w-full overflow-hidden rounded-full hover:!translate-y-0">
						{services.map((s, i) => (
							<button
								key={s.key}
								type="button"
								aria-pressed={s.on}
								aria-label={`Only ${s.name}`}
								title={`Only ${s.name}`}
								onClick={s.press}
								className={`flex flex-1 items-center justify-center hover:bg-white/10 active:bg-black/20 ${i ? "border-l border-black/50" : ""} ${s.on ? "bg-amber-400/15 shadow-[inset_0_-3px_0_#fdba74]" : ""}`}
							>
								<ServiceLogo k={s.key} w={50} />
							</button>
						))}
					</div>
				)}
				{streaming === "one" && (
					<button
						type="button"
						aria-pressed={at >= 0}
						aria-label="Next streaming service"
						title="Next streaming service"
						// The last service's own key again clears it.
						onClick={(services[at + 1] ?? services[at]).press}
						className="remote-key remote-service mx-auto flex h-[54px] w-[190px] items-center justify-center gap-3 rounded-full"
					>
						{services.map((s) => (
							<ServiceLogo
								key={s.key}
								k={s.key}
								w={42}
								dim={at >= 0 && !s.on}
							/>
						))}
					</button>
				)}
				{streaming === "round" && round}
				{arc && (
					<div className="grid grid-cols-2 gap-3 px-[7px]">
						{services.slice(0, 2).map((s) => (
							<button
								key={s.key}
								type="button"
								aria-pressed={s.on}
								aria-label={`Only ${s.name}`}
								title={`Only ${s.name}`}
								onClick={s.press}
								className="remote-key remote-service flex h-[52px] items-center justify-center rounded-full"
							>
								<ServiceLogo k={s.key} w={68} />
							</button>
						))}
					</div>
				)}
				{streaming === "pills" && (
					<div className="grid grid-cols-3 gap-2">
						{services.map((s) => (
							<button
								key={s.key}
								type="button"
								aria-pressed={s.on}
								aria-label={`Only ${s.name}`}
								title={`Only ${s.name}`}
								onClick={s.press}
								className="remote-key remote-service flex h-11 items-center justify-center rounded-full"
							>
								<ServiceLogo k={s.key} w={48} />
							</button>
						))}
					</div>
				)}
			</div>
			<Logo />
		</Body>
	)
}
