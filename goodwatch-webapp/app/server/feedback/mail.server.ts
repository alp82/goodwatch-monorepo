import type { SendMailOptions } from "nodemailer"
import type { Report } from "./handler.server"
export function feedbackMail(r: Report): SendMailOptions {
	return {
		from: "GoodWatch <hello@goodwatch.app>",
		to: "hello@goodwatch.app",
		replyTo: r.email,
		subject: `GoodWatch feedback: ${r.kind} (${r.id.slice(0, 12)})`,
		text: `${r.message}\n\nReport: ${r.id}\nMember: ${r.memberId ?? "Guest"}\n${JSON.stringify(r.metadata)}\n${JSON.stringify(r.data ?? {})}`,
		attachments: r.screenshot
			? [
					{
						filename: "screenshot.webp",
						content: Buffer.from(r.screenshot, "base64"),
						contentType: "image/webp",
					},
				]
			: [],
	}
}
