// The account emails (#534, #550): one look for all five, as the prototype showed it. Every email has a plain-text
// part with the same words and the full link, for mail apps that show no HTML.
export type AuthEmail = { subject: string; text: string; html: string }

const escape = (value: string) =>
	value.replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			]!,
	)

function email(parts: {
	subject: string
	preheader: string
	title: string
	body: string
	button?: { label: string; url: string }
	footer: string
}): AuthEmail {
	const { subject, preheader, title, body, button, footer } = parts
	const text = [
		title,
		"",
		body,
		...(button ? ["", `${button.label}: ${button.url}`] : []),
		"",
		footer,
		"",
		"GoodWatch · https://goodwatch.app",
		"",
	].join("\n")
	// Tables and inline styles: what mail apps still render the same. Colors are the site's amber and grays.
	const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:448px;background:#ffffff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1);">
<tr><td style="padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
<p style="margin:0 0 24px;font-size:20px;font-weight:900;letter-spacing:-0.025em;">Good<span style="color:#f59e0b;">Watch</span></p>
<h1 style="margin:0 0 12px;font-size:24px;line-height:32px;font-weight:700;color:#111827;">${escape(title)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:26px;color:#374151;">${escape(body)}</p>
${
	button
		? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#d97706;"><a href="${escape(button.url)}" style="display:inline-block;padding:12px 24px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escape(button.label)}</a></td></tr></table>`
		: ""
}
<p style="margin:24px 0 0;font-size:14px;line-height:22px;color:#6b7280;">${escape(footer)}</p>
${
	button
		? `<p style="margin:16px 0 0;font-size:12px;line-height:18px;color:#9ca3af;word-break:break-all;">Or paste this address: ${escape(button.url)}</p>`
		: ""
}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`
	return { subject, text, html }
}

export const confirmEmail = (address: string, url: string) =>
	email({
		subject: "Confirm your email for GoodWatch",
		preheader: "One tap and your account is ready.",
		title: "Confirm your email",
		body: `Tap the button to confirm ${address} and finish creating your GoodWatch account.`,
		button: { label: "Confirm email", url },
		footer:
			"The link works for 24 hours, and only the newest one works. Didn't sign up for GoodWatch? Ignore this email and no account is created.",
	})

export const resetPasswordEmail = (address: string, url: string) =>
	email({
		subject: "Set a new GoodWatch password",
		preheader: "Someone asked to reset the password for your account.",
		title: "Set a new password",
		body: `Someone (we hope you) asked to set a new password for the GoodWatch account of ${address}.`,
		button: { label: "Set new password", url },
		footer:
			"The link works for one hour and only once. Didn't ask for this? Ignore this email; your password stays as it is.",
	})

export const passwordChangedEmail = (origin: string) =>
	email({
		subject: "Your GoodWatch password changed",
		preheader: "Other devices have been signed out.",
		title: "Your password changed",
		body: "The password of your GoodWatch account was just changed. Other devices have been signed out; connected apps keep working.",
		button: { label: "Set a new password", url: `${origin}/forgot-password` },
		footer:
			"Was this you? Then there's nothing to do. If it wasn't, set a new password right away.",
	})

export const existingAccountEmail = (origin: string) =>
	email({
		subject: "You already have a GoodWatch account",
		preheader: "Someone tried to create a new account with this email.",
		title: "You already have an account",
		body: "Someone tried to create a GoodWatch account with this email, but there is one already. Sign in to it, or set a new password if you forgot it.",
		button: { label: "Sign in", url: `${origin}/sign-in` },
		footer: "Wasn't you? Ignore this email; nothing changes.",
	})

export const googleOnlyEmail = (origin: string) =>
	email({
		subject: "You sign in with Google",
		preheader: "Your GoodWatch account has no password.",
		title: "You sign in with Google",
		body: "Someone asked to reset the password of your GoodWatch account. You use Google to sign in, so there is no password to reset: choose Continue with Google on the sign-in page.",
		button: { label: "Sign in", url: `${origin}/sign-in` },
		footer: "Didn't ask for this? Ignore this email; nothing changes.",
	})
