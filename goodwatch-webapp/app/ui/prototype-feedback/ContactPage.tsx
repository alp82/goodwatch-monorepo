// PROTOTYPE - throwaway. /support with a contact form in place of the mailto button, in the page's own layout (header
// card, tiles). Members' email is filled in and locked; hello@goodwatch.app stays visible as a fallback.
// - A: the form takes the header card's right side, where the email button was.
// - B: the header keeps the email button; a full-width "Write to us" tile with topic chips comes first.
// - C: pick a topic first (tiles); the form opens under it.
import {
	ArrowRightIcon,
	BugAntIcon,
	ChatBubbleLeftRightIcon,
	CheckCircleIcon,
	EnvelopeIcon,
	FilmIcon,
	KeyIcon,
	LightBulbIcon,
	LockClosedIcon,
	ShieldCheckIcon,
	SparklesIcon,
} from "@heroicons/react/24/outline"
import type { ComponentType, ReactNode, SVGProps } from "react"
import { useState } from "react"
import { PrimaryButton } from "~/ui/auth/kit"
import { Chip, INPUT } from "~/ui/prototype-feedback/ReportFlow"
import { useFeedback } from "~/ui/prototype-feedback/store"

const SUPPORT_EMAIL = "hello@goodwatch.app"
const MEMBER_EMAIL = "you@example.com"
const linkClass = "font-semibold text-amber-500 hover:text-amber-400"
const LABEL = "mb-1.5 block text-sm font-medium text-gray-300"

const TOPICS = [
	{ id: "account", label: "My account", Icon: KeyIcon },
	{ id: "data", label: "A title's data", Icon: FilmIcon },
	{ id: "bug", label: "Something's broken", Icon: BugAntIcon },
	{ id: "idea", label: "An idea", Icon: LightBulbIcon },
	{ id: "ai", label: "AI apps", Icon: SparklesIcon },
	{ id: "other", label: "Something else", Icon: ChatBubbleLeftRightIcon },
] as const
type Topic = (typeof TOPICS)[number]["id"]

function Sent({ email, onAgain }: { email: string; onAgain: () => void }) {
	return (
		<div className="flex flex-col gap-3" aria-live="polite">
			<div className="flex items-start gap-3">
				<CheckCircleIcon className="size-7 shrink-0 text-emerald-400" />
				<div>
					<p className="text-lg font-semibold text-white">Sent. We'll write back.</p>
					<p className="mt-0.5 text-sm text-gray-400">
						We answer at <span className="text-gray-200">{email || "your email"}</span>, usually within two days.
					</p>
				</div>
			</div>
			<button type="button" onClick={onAgain} className="self-start text-sm font-semibold text-amber-500 hover:text-amber-400">
				Write another message
			</button>
		</div>
	)
}

function Form({ topic: fixedTopic, chips = true, compact }: { topic?: Topic; chips?: boolean; compact?: boolean }) {
	const { viewer } = useFeedback()
	const member = viewer !== "guest"
	const [topic, setTopic] = useState<Topic>(fixedTopic ?? "account")
	const [message, setMessage] = useState("")
	const [email, setEmail] = useState(member ? MEMBER_EMAIL : "")
	const [sent, setSent] = useState(false)
	const [failed, setFailed] = useState(false)
	const t = fixedTopic ?? topic
	if (sent)
		return (
			<Sent
				email={email}
				onAgain={() => {
					setSent(false)
					setMessage("")
				}}
			/>
		)
	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault()
				// The first send fails on purpose once, to show the retry. The second one goes through.
				if (message.toLowerCase().includes("fail") && !failed) return setFailed(true)
				setSent(true)
			}}
		>
			{chips && !fixedTopic && (
				<div>
					<span className={LABEL}>Topic</span>
					<div className="flex flex-wrap gap-2">
						{TOPICS.map((x) => (
							<Chip key={x.id} on={topic === x.id} onClick={() => setTopic(x.id)}>
								{x.label}
							</Chip>
						))}
					</div>
				</div>
			)}
			{!chips && !fixedTopic && (
				<label>
					<span className={LABEL}>Topic</span>
					<select value={topic} onChange={(e) => setTopic(e.target.value as Topic)} className={INPUT}>
						{TOPICS.map((x) => (
							<option key={x.id} value={x.id}>
								{x.label}
							</option>
						))}
					</select>
				</label>
			)}
			<label>
				<span className={LABEL}>Message</span>
				<textarea
					required
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					rows={compact ? 4 : 5}
					placeholder={t === "account" ? "What do you need help with?" : t === "bug" ? "What happened, and where?" : "Write to us"}
					className={`${INPUT} py-2.5`}
				/>
			</label>
			<label>
				<span className={LABEL}>Your email</span>
				<span className="relative block">
					<input
						type="email"
						required
						value={email}
						readOnly={member}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="you@example.com"
						className={`${INPUT} ${member ? "pr-10 text-gray-400" : ""}`}
					/>
					{member && <LockClosedIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-gray-500" aria-hidden />}
				</span>
				<span className="mt-1 block text-xs text-gray-500">{member ? "Your account's email. We answer there." : "We only use it to answer you."}</span>
			</label>
			{failed && (
				<p role="alert" className="rounded-xl border border-red-700 bg-red-950/50 p-3 text-sm text-red-100">
					That didn't go through. Try again, or write to{" "}
					<a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>
						{SUPPORT_EMAIL}
					</a>
					.
				</p>
			)}
			<PrimaryButton>{failed ? "Try again" : "Send"}</PrimaryButton>
		</form>
	)
}

const Fallback = ({ center }: { center?: boolean }) => (
	<p className={`text-sm text-gray-400 ${center ? "text-center" : ""}`}>
		Or email{" "}
		<a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>
			{SUPPORT_EMAIL}
		</a>
	</p>
)

const MailButton = () => (
	<a
		href={`mailto:${SUPPORT_EMAIL}`}
		className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-600"
	>
		<EnvelopeIcon className="h-5 w-5" aria-hidden="true" />
		{SUPPORT_EMAIL}
	</a>
)

function TopicFirst() {
	const [topic, setTopic] = useState<Topic | null>(null)
	return (
		<section className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 md:p-6">
			<h2 className="flex items-center gap-2 text-lg font-semibold text-white">
				<EnvelopeIcon className="h-5 w-5 text-amber-400" aria-hidden="true" />
				What's it about?
			</h2>
			<p className="mb-4 text-sm text-gray-400">Pick one, then write to us.</p>
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
				{TOPICS.map(({ id, label, Icon }) => (
					<button
						key={id}
						type="button"
						aria-pressed={topic === id}
						onClick={() => setTopic(id)}
						className={`flex min-h-14 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold ring-1 transition-colors ${topic === id ? "bg-amber-500/10 text-white ring-amber-500/60" : "bg-white/[0.04] text-gray-200 ring-white/10 hover:ring-white/25"}`}
					>
						<Icon className="size-5 shrink-0 text-amber-400" aria-hidden />
						{label}
					</button>
				))}
			</div>
			{topic && (
				<div className="mt-5 border-t border-white/10 pt-5">
					<div className="md:max-w-xl">
						<Form key={topic} topic={topic} compact />
					</div>
				</div>
			)}
			<div className="mt-4">
				<Fallback />
			</div>
		</section>
	)
}

export default function ContactPage() {
	const { variant } = useFeedback()
	return (
		<div data-feedback-page className="mx-auto max-w-5xl px-4 py-6 pb-40 text-gray-300 md:px-8 md:py-10">
			<header
				className={`flex flex-col gap-5 rounded-2xl bg-gradient-to-br from-amber-950/70 via-gray-900 to-gray-900 p-5 ring-1 ring-amber-500/20 md:p-8 ${variant === "A" ? "md:grid md:grid-cols-[1fr_minmax(0,24rem)] md:items-start md:gap-8" : "md:flex-row md:items-center md:justify-between"}`}
			>
				<div className="flex flex-col gap-2">
					<h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Support</h1>
					<p className="max-w-xl text-lg leading-relaxed text-gray-300">
						Something not working, or a question about your account? Write to us. We read every message.
					</p>
					{variant === "A" && (
						<div className="mt-2 max-md:hidden">
							<Fallback />
						</div>
					)}
				</div>
				{variant === "A" ? (
					<div className="flex flex-col gap-3 rounded-xl bg-gray-950/60 p-4 ring-1 ring-white/10">
						<Form chips={false} compact />
						<div className="md:hidden">
							<Fallback center />
						</div>
					</div>
				) : variant === "B" ? (
					<div className="flex shrink-0 flex-col gap-2">
						<MailButton />
						<p className="text-center text-sm text-gray-400">Or use the form below.</p>
					</div>
				) : (
					<div className="flex shrink-0 flex-col gap-2">
						<a href="#write" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-600">
							<EnvelopeIcon className="h-5 w-5" aria-hidden="true" />
							Write to us
						</a>
					</div>
				)}
			</header>

			{variant === "B" && (
				<section id="write" className="mt-4 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 md:mt-6 md:p-6">
					<h2 className="flex items-center gap-2 text-lg font-semibold text-white">
						<EnvelopeIcon className="h-5 w-5 text-amber-400" aria-hidden="true" />
						Write to us
					</h2>
					<p className="mb-4 text-sm text-gray-400">We answer by email, usually within two days.</p>
					<div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_14rem]">
						<Form />
						<div className="flex flex-col gap-3 text-sm text-gray-400 md:border-l md:border-white/10 md:pl-6">
							<p>Wrong data on a title? Use Report a problem on the title page.</p>
							<p>Prefer email? {" "}<a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>{SUPPORT_EMAIL}</a></p>
						</div>
					</div>
				</section>
			)}
			{variant === "C" && (
				<div id="write" className="mt-4 md:mt-6">
					<TopicFirst />
				</div>
			)}

			<div className="mt-4 grid gap-4 md:mt-6 md:grid-cols-2">
				<Tile icon={ChatBubbleLeftRightIcon} label="AI apps" hint="GoodWatch in Claude, ChatGPT and other assistants" more="More fixes">
					<Fix q="It says GoodWatch isn't connected.">Connect again from the app, for example in Claude under Customize → Connectors. Your GoodWatch data stays as it was.</Fix>
					<Fix q="New features don't show up.">Start a new chat. If that doesn't help, disconnect GoodWatch in the app and connect it again.</Fix>
				</Tile>
				<Tile icon={KeyIcon} label="Your account" hint="Signing in, passwords and your email address" more="Account and sign-in">
					<Fix q="I can't sign in.">On Sign in, use the way you signed up: your email and password, or Continue with Google.</Fix>
					<Fix q="I forgot my password.">Reset your password. We email you a link. If it doesn't arrive in a few minutes, look in your spam folder.</Fix>
				</Tile>
				<Tile icon={ShieldCheckIcon} label="Privacy" hint="What GoodWatch keeps, and what connected apps can see" more="Read the privacy policy">
					<p className="leading-relaxed">We only email you about your account: no newsletters, no ads.</p>
				</Tile>
			</div>
		</div>
	)
}

// As routes/support.tsx.
function Tile({ icon: Icon, label, hint, more, children }: { icon: ComponentType<SVGProps<SVGSVGElement>>; label: string; hint: string; more: string; children: ReactNode }) {
	return (
		<section aria-label={label} className="flex flex-col rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 md:p-6">
			<h2 className="flex items-center gap-2 text-lg font-semibold text-white">
				<Icon className="h-5 w-5 text-amber-400" aria-hidden="true" />
				{label}
			</h2>
			<p className="mb-4 text-sm text-gray-400">{hint}</p>
			<div className="flex flex-col gap-4">{children}</div>
			<span className="mt-auto inline-flex items-center gap-1.5 self-start pt-5 text-sm font-semibold text-gray-200">
				{more}
				<ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
			</span>
		</section>
	)
}

function Fix({ q, children }: { q: string; children: ReactNode }) {
	return (
		<div>
			<h3 className="font-semibold text-gray-100">{q}</h3>
			<p className="mt-1 leading-relaxed text-gray-300">{children}</p>
		</div>
	)
}
