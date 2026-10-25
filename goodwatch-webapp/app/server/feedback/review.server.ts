import type { Interaction } from "../discord/router.server.ts"
import { feedbackStaff, type Correction } from "./corrections.ts"
import { memberText } from "./discord-post.ts"
import { reviewButtons } from "./review-buttons.ts"
export async function reviewInteraction(
	interaction: Interaction,
	deps: {
		decide(
			id: string,
			action: "approve" | "reject" | "revert",
			actor: string,
		): Promise<Correction>
		env?: Record<string, string | undefined>
	},
) {
	const match = /^feedback:(approve|reject|revert):([a-f0-9]{64})$/.exec(
		interaction.data?.custom_id ?? "",
	)
	const reply = (content: string) => ({
		type: 4,
		data: { content, flags: 64, allowed_mentions: { parse: [] } },
	})
	const user = interaction.member?.user?.id ?? interaction.user?.id
	if (!feedbackStaff(user, interaction.member?.roles, deps.env))
		return reply("Staff only.")
	if (!match) return reply("Invalid correction.")
	try {
		const c = await deps.decide(
			match[2],
			match[1] as "approve" | "reject" | "revert",
			user!,
		)
		const components = (interaction.message?.components ?? []).filter(
			(x) =>
				!(
					x.type === 1 &&
					Array.isArray(x.components) &&
					x.components.some((b: any) => b.custom_id?.startsWith("feedback:"))
				),
		)
		components.push({
			type: 10,
			content: `Correction **${c.status}** · ${memberText(c.field, 100)}`,
		})
		const buttons = reviewButtons(c)
		if (buttons.components.length) components.push(buttons)
		return { type: 7, data: { components, allowed_mentions: { parse: [] } } }
	} catch (error) {
		return reply(
			error instanceof Response && error.status === 409
				? "This correction changed. Refresh the post before deciding again."
				: "The correction could not be updated. Try again.",
		)
	}
}
