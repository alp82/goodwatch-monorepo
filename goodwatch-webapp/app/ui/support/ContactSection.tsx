// The contact form on /support (#764, variant C of the feedback prototype): pick a topic first, then write. A
// member's email is filled in and locked; a guest types one. Sends to POST /api/feedback as kind `contact`.
// A failed send keeps every typed word and offers a retry with the same idempotency key, so a send that did arrive
// is not posted twice. hello@goodwatch.app stays visible the whole time.
import {
	BugAntIcon,
	ChatBubbleLeftRightIcon,
	CheckCircleIcon,
	EnvelopeIcon,
	FilmIcon,
	KeyIcon,
	LightBulbIcon,
	LockClosedIcon,
	SparklesIcon,
} from "@heroicons/react/24/outline"
import {
	type ComponentType,
	type FormEvent,
	type SVGProps,
	useEffect,
	useId,
	useRef,
	useState,
} from "react"
import {
	CONTACT_TOPICS,
	type ContactFailure,
	type ContactProblem,
	type ContactTopic,
	MESSAGE_MAX,
	SUPPORT_EMAIL,
	TITLE_MAX,
	buildContactRequest,
	contactFailure,
	contactProblems,
	holdBeforeSend,
	newIdempotencyKey,
} from "~/ui/support/contact"
import { Spinner } from "~/ui/wait/Spinner"
import { useUser } from "~/utils/auth"
import { FeedbackError, submitFeedback } from "~/utils/feedback"

export const CONTACT_SECTION_ID = "write"

const ICONS: Record<ContactTopic, ComponentType<SVGProps<SVGSVGElement>>> = {
	account: KeyIcon,
	data: FilmIcon,
	bug: BugAntIcon,
	idea: LightBulbIcon,
	ai: SparklesIcon,
	other: ChatBubbleLeftRightIcon,
}
const PLACEHOLDERS: Record<ContactTopic, string> = {
	account: "What do you need help with?",
	data: "What's wrong, and what should it say?",
	bug: "What happened, and where?",
	idea: "What would make GoodWatch better for you?",
	ai: "Which app, and what happened?",
	other: "Write to us",
}

const linkClass = "font-semibold text-amber-500 hover:text-amber-400"
const LABEL = "mb-1.5 block text-sm font-medium text-gray-300"
// As the fields of Edit profile.
const FIELD =
	"min-h-11 w-full rounded-lg bg-gray-900 px-3 text-gray-100 ring-1 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
const field = (invalid = false) =>
	`${FIELD} ${invalid ? "ring-red-500" : "ring-white/15"}`
// As the page's former email button.
const SEND =
	"inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-60"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const MailLink = () => (
	<a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>
		{SUPPORT_EMAIL}
	</a>
)

export function ContactSection() {
	const { user } = useUser()
	const memberEmail = user?.email || null

	const [topic, setTopic] = useState<ContactTopic | null>(null)
	const [message, setMessage] = useState("")
	const [typedEmail, setTypedEmail] = useState("")
	const [title, setTitle] = useState("")
	const [website, setWebsite] = useState("")
	const body = useRef<HTMLDivElement>(null)
	const [bodyHeight, setBodyHeight] = useState(0)
	const [sending, setSending] = useState(false)
	const [sentTo, setSentTo] = useState<string | null>(null)
	const [failure, setFailure] = useState<ContactFailure | null>(null)
	const [problems, setProblems] = useState<ContactProblem[]>([])
	// When the form first opened, and one key per message: a retry reuses it, a new message gets a new one.
	const startedAt = useRef<number | null>(null)
	const key = useRef<string | null>(null)
	const lastDraft = useRef<string | null>(null)
	const success = useRef<HTMLParagraphElement>(null)
	const hadSuccess = useRef(false)
	const ids = useId()

	const email = memberEmail ?? typedEmail

	useEffect(() => {
		if (sentTo !== null) {
			success.current?.focus()
			hadSuccess.current = true
		} else if (hadSuccess.current) {
			document.getElementById(`${ids}-message`)?.focus()
			hadSuccess.current = false
		}
	}, [sentTo, ids])

	const pick = (next: ContactTopic) => {
		if (startedAt.current === null) startedAt.current = Date.now()
		setTopic(next)
		setSentTo(null)
	}

	const submit = async (event: FormEvent) => {
		event.preventDefault()
		if (!topic || sending) return
		const draft = { topic, message, email, title }
		const found = contactProblems(draft)
		setProblems(found)
		if (found.length > 0) {
			document.getElementById(`${ids}-${found[0]}`)?.focus()
			return
		}
		const now = Date.now()
		if (startedAt.current === null || now - startedAt.current > 86_400_000) {
			startedAt.current = now
		}
		const opened = startedAt.current
		// An edited draft is a new report; only an unchanged retry shares its key.
		const signature = JSON.stringify(draft)
		if (lastDraft.current !== signature) key.current = null
		lastDraft.current = signature
		key.current ??= newIdempotencyKey(window.crypto)
		setBodyHeight(body.current?.getBoundingClientRect().height ?? 0)
		setSending(true)
		setFailure(null)
		try {
			await wait(holdBeforeSend(opened, Date.now()))
			await submitFeedback(
				buildContactRequest(draft, {
					idempotencyKey: key.current,
					startedAt: opened,
					website,
					metadata: {
						url: window.location.pathname,
						locale: navigator.language,
						time: new Date().toISOString(),
					},
				}),
			)
			setSentTo(email.trim())
			setMessage("")
			setTitle("")
			key.current = null
			startedAt.current = Date.now()
		} catch (error) {
			setFailure(
				contactFailure(error instanceof FeedbackError ? error.status : 0),
			)
		} finally {
			setSending(false)
		}
	}

	return (
		<section
			id={CONTACT_SECTION_ID}
			aria-labelledby={`${ids}-heading`}
			className="scroll-mt-24 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 md:p-6"
		>
			<h2
				id={`${ids}-heading`}
				className="flex items-center gap-2 text-lg font-semibold text-white"
			>
				<EnvelopeIcon className="h-5 w-5 text-amber-400" aria-hidden="true" />
				What's it about?
			</h2>
			<p className="mb-4 text-sm text-gray-400">
				Pick one, then write to us. We answer by email.
			</p>
			<fieldset
				disabled={sending}
				className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3"
			>
				<legend className="sr-only">Topic</legend>
				{CONTACT_TOPICS.map(({ id, label }) => {
					const Icon = ICONS[id]
					const on = topic === id
					return (
						<label
							key={id}
							className={`flex min-h-14 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold ring-1 transition-colors focus-within:ring-2 focus-within:ring-amber-400 ${on ? "bg-amber-500/10 text-white ring-amber-500/60" : "bg-white/[0.04] text-gray-200 ring-white/10 hover:ring-white/25"}`}
						>
							<input
								type="radio"
								name={`${ids}-topic`}
								value={id}
								checked={on}
								onChange={() => pick(id)}
								className="sr-only"
							/>
							<Icon
								className="size-5 shrink-0 text-amber-400"
								aria-hidden="true"
							/>
							{label}
						</label>
					)
				})}
			</fieldset>

			<p className="sr-only" aria-live="polite">
				{sentTo !== null ? "Sent. We'll write back." : ""}
			</p>
			<div ref={body} style={{ minHeight: bodyHeight || undefined }}>
				{sentTo !== null ? (
					<div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5">
						<div className="flex items-start gap-3">
							<CheckCircleIcon
								className="size-7 shrink-0 text-emerald-400"
								aria-hidden="true"
							/>
							<div>
								<p
									ref={success}
									tabIndex={-1}
									className="text-lg font-semibold text-white"
								>
									Sent. We'll write back.
								</p>
								<p className="mt-0.5 break-words text-sm text-gray-400">
									We answer at <span className="text-gray-200">{sentTo}</span>.
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={() => setSentTo(null)}
							className="self-start text-sm font-semibold text-amber-500 hover:text-amber-400"
						>
							Write another message
						</button>
					</div>
				) : topic !== null ? (
					<form
						noValidate
						onSubmit={submit}
						className="mt-5 border-t border-white/10 pt-5"
					>
						<fieldset
							disabled={sending}
							className="flex min-w-0 flex-col gap-4 md:max-w-xl"
						>
							<legend className="sr-only">Your message</legend>
							<div hidden>
								<label htmlFor={`${ids}-website`}>Website</label>
								<input
									id={`${ids}-website`}
									name="website"
									value={website}
									onChange={(e) => setWebsite(e.target.value)}
									autoComplete="off"
									tabIndex={-1}
								/>
							</div>
							{topic === "data" && (
								<>
									<p className="text-sm leading-relaxed text-gray-300">
										Tell us which title and what's wrong. A link to its
										GoodWatch page helps us find it fast.
									</p>
									<div>
										<label htmlFor={`${ids}-title`} className={LABEL}>
											Which title?
										</label>
										<input
											id={`${ids}-title`}
											type="text"
											value={title}
											maxLength={TITLE_MAX}
											onChange={(e) => setTitle(e.target.value)}
											placeholder="Link or name"
											className={field()}
										/>
									</div>
								</>
							)}
							<div>
								<label htmlFor={`${ids}-message`} className={LABEL}>
									Message
								</label>
								<textarea
									id={`${ids}-message`}
									rows={5}
									required
									maxLength={MESSAGE_MAX}
									value={message}
									onChange={(e) => setMessage(e.target.value)}
									placeholder={PLACEHOLDERS[topic]}
									aria-invalid={problems.includes("message") || undefined}
									aria-describedby={
										problems.includes("message")
											? `${ids}-message-error`
											: undefined
									}
									className={`${field(problems.includes("message"))} py-2.5`}
								/>
								{problems.includes("message") && (
									<p
										id={`${ids}-message-error`}
										className="mt-1 text-sm text-red-300"
									>
										Write a few words first.
									</p>
								)}
							</div>
							<div>
								<label htmlFor={`${ids}-email`} className={LABEL}>
									Your email
								</label>
								<span className="relative block">
									<input
										id={`${ids}-email`}
										type="email"
										autoComplete="email"
										required
										value={email}
										readOnly={memberEmail !== null}
										onChange={(e) => setTypedEmail(e.target.value)}
										placeholder="you@example.com"
										aria-invalid={problems.includes("email") || undefined}
										aria-describedby={`${ids}-email-hint`}
										className={`${field(problems.includes("email"))} ${memberEmail !== null ? "pr-10 text-gray-400" : ""}`}
									/>
									{memberEmail !== null && (
										<LockClosedIcon
											className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-500"
											aria-hidden="true"
										/>
									)}
								</span>
								<span
									id={`${ids}-email-hint`}
									className={`mt-1 block text-xs ${problems.includes("email") ? "text-red-300" : "text-gray-500"}`}
								>
									{problems.includes("email")
										? "Add an email address we can answer."
										: memberEmail !== null
											? "Your account's email. We answer there."
											: "We only use it to answer you."}
								</span>
							</div>
							{failure && (
								<p
									role="alert"
									className="rounded-xl border border-red-700 bg-red-950/50 p-3 text-sm text-red-100"
								>
									{failure === "busy" ? (
										<>
											That's a lot of messages in a short time. Try again in an
											hour, or write to <MailLink />.
										</>
									) : failure === "rejected" ? (
										<>
											We couldn't take that message. Check your email address,
											or write to <MailLink />.
										</>
									) : (
										<>
											That didn't go through. Your message is still here. Try
											again, or write to <MailLink />.
										</>
									)}
								</p>
							)}
							<button
								type="submit"
								disabled={sending}
								aria-busy={sending || undefined}
								className={`${SEND} sm:self-start sm:min-w-40`}
							>
								{sending ? (
									<>
										<Spinner size="small" />
										<span>Sending…</span>
									</>
								) : failure === "retry" ? (
									"Try again"
								) : (
									"Send"
								)}
							</button>
						</fieldset>
					</form>
				) : null}
			</div>

			<p className="mt-4 text-sm text-gray-400">
				Or email <MailLink />
			</p>
		</section>
	)
}
