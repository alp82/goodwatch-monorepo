// A picked part's questions on pages without a title or person flow: one chip, a few words, a guest's optional email,
// Send. These are reports for staff; nothing changes on the page.
import { FlagIcon } from "@heroicons/react/20/solid"
import { useState } from "react"
import { PrimaryButton } from "~/ui/auth/kit"
import { type FeedbackOutcome, outcomeOf } from "~/utils/feedback"
import { type PageArea, SOMETHING_ELSE, chipsOf } from "./areas"
import {
	BeforeSendLine,
	FailureLine,
	GuestEmail,
	INPUT,
	LABEL,
	Result,
	SendFooter,
	useFixFlow,
	useSender,
} from "./kit"
import { type Report, subjectOf } from "./problems"
import { buildReportRequest, emailProblem, fallbackOutcome } from "./request"
import type { FeedbackSubject } from "./subject"

export function AreaFlow({
	area,
	subject,
}: { area: PageArea; subject: FeedbackSubject | null }) {
	const flow = useFixFlow()
	const guest = flow?.guest ?? false
	const sender = useSender()
	const [chip, setChip] = useState<number | null>(null)
	const [note, setNote] = useState("")
	const [email, setEmail] = useState("")
	const [sent, setSent] = useState<{
		outcome: FeedbackOutcome
		correctionId: string | null
	} | null>(null)
	const chips = chipsOf(area)
	const picked = chip === null ? null : chips[chip]
	const other = picked?.label === SOMETHING_ELSE
	if (sent)
		return (
			<Result
				{...sent}
				email={email}
				onAnother={() => {
					setSent(null)
					setChip(null)
					setNote("")
					sender.reset()
					flow?.again()
				}}
				onDone={() => flow?.done()}
			/>
		)
	const send = async () => {
		if (!picked) return
		const report: Report = {
			area: area.id,
			problem: picked.id,
			label: picked.label,
			kind: picked.kind,
			subject: subjectOf(subject),
			field: area.id,
			note: note.trim() || undefined,
		}
		const response = await sender.send(
			(e) => buildReportRequest(report, e),
			guest ? email : undefined,
		)
		if (!response) return
		setSent(outcomeOf(response, fallbackOutcome(picked.kind)))
		flow?.sent()
	}
	return (
		<div className="flex flex-col gap-5" data-area-flow={area.id}>
			<div>
				<span className={LABEL}>What's wrong?</span>
				<div className="flex flex-wrap gap-2">
					{chips.map((c, i) => (
						<button
							key={c.id}
							type="button"
							aria-pressed={chip === i}
							onClick={() => setChip(i)}
							className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${chip === i ? "bg-white font-semibold text-black" : "bg-white/8 text-gray-200 hover:bg-white/15"}`}
						>
							{c.kind === "flag" && (
								<FlagIcon className="size-3.5 opacity-60" aria-hidden />
							)}
							{c.label}
						</button>
					))}
				</div>
			</div>
			{picked && (
				<label className="flex flex-col gap-1.5">
					<span className="text-sm font-medium text-gray-300">
						{other ? "What's wrong?" : "Anything to add?"}{" "}
						{!other && (
							<span className="font-normal text-gray-500">(optional)</span>
						)}
					</span>
					<textarea
						value={note}
						onChange={(e) => setNote(e.target.value)}
						rows={3}
						maxLength={2000}
						placeholder={
							picked.kind === "fix"
								? "Which one, and what it should be"
								: "Which one, and what looks off"
						}
						className={`${INPUT} py-2.5`}
					/>
				</label>
			)}
			{picked && guest && (
				<GuestEmail
					value={email}
					onChange={setEmail}
					invalid={emailProblem(email)}
				/>
			)}
			<SendFooter>
				<FailureLine failure={sender.failure} />
				{picked && (
					<div className="mb-2">
						<BeforeSendLine kind={picked.kind} />
					</div>
				)}
				<PrimaryButton
					type="button"
					disabled={
						!picked ||
						(other && !note.trim()) ||
						(guest && emailProblem(email)) ||
						sender.sending
					}
					onClick={send}
				>
					{sender.sending ? "Sending…" : "Send"}
				</PrimaryButton>
			</SendFooter>
		</div>
	)
}
