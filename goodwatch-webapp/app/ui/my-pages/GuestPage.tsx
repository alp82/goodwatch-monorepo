// What a guest sees on My shows and My library (#385): the page's name, what it is, and the sign-up prompt. The pages
// hold a member's watch state, which a guest does not have.
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import type { SignUpMessage } from "~/ui/sign-up-prompt/messages"
import { WRAP } from "~/ui/watch-next/style"
import { PageHead } from "./bits"

export function GuestPage({
	name,
	line,
	words,
}: { name: string; line: string; words: SignUpMessage }) {
	return (
		<div className="pb-24" data-guest-page>
			<PageHead name={name} line={line} />
			<div className={WRAP}>
				<SignUpPrompt
					feature="watchNext"
					words={words}
					size="card"
					className="max-w-xl"
				/>
			</div>
		</div>
	)
}
