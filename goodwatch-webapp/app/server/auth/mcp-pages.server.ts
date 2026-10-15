const escapeHtml = (value: string): string =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")

const page = (title: string, body: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="strict-origin">
<title>${escapeHtml(title)} – GoodWatch</title>
<style>
body{font-family:system-ui,sans-serif;background:#111;color:#eee;margin:0;padding:2rem 1rem;line-height:1.5}
main{max-width:28rem;margin:0 auto;background:#1c1c1c;padding:1.5rem;border-radius:.5rem}
h1{font-size:1.4rem;margin-top:0}
.note{font-size:.9rem;color:#bbb;border-left:3px solid #666;padding-left:.75rem}
.warn{background:#4a1d1d;border:1px solid #c44;padding:.75rem;border-radius:.375rem}
label{display:block;margin-top:1rem;font-weight:600}
input{width:100%;box-sizing:border-box;padding:.5rem;margin-top:.25rem;font-size:1rem}
button{margin-top:1.25rem;margin-right:.5rem;padding:.6rem 1.2rem;font-size:1rem;border-radius:.375rem;border:1px solid #888;cursor:pointer}
button[value=allow],.primary{background:#e8b923;color:#111;border-color:#e8b923}
code{word-break:break-all;background:#000;padding:.1rem .3rem;border-radius:.25rem}
:focus-visible{outline:3px solid #6af;outline-offset:2px}
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`

const temporaryNote = `<p class="note">This is a temporary connection page. The full GoodWatch account pages are coming soon.</p>`

export function renderMcpLogin(): string {
	return page(
		"Sign in to connect",
		`<h1>Sign in to GoodWatch</h1>
${temporaryNote}
<p>Sign in to connect an app to your GoodWatch account.</p>
<form method="post">
<label for="email">Email</label>
<input id="email" name="email" type="email" autocomplete="email" required>
<label for="password">Password</label>
<input id="password" name="password" type="password" autocomplete="current-password" required>
<button type="submit" class="primary">Sign in</button>
</form>`,
	)
}

export function renderMcpConsent(data: {
	clientName: string
	clientId: string
	redirectUri: string
	scopes: string[]
	unverified: boolean
}): string {
	const name = escapeHtml(data.clientName)
	const scopes = data.scopes
		.map((scope) => `<li><code>${escapeHtml(scope)}</code></li>`)
		.join("\n")
	const warning = data.unverified
		? `<div class="warn" role="alert"><strong>Unverified app.</strong> GoodWatch has not checked this app. It registered itself and its name could be fake. Only allow it if you trust where it came from.</div>`
		: ""

	return page(
		"Connect an app",
		`<h1>Connect ${name} to GoodWatch?</h1>
${temporaryNote}
${warning}
<p><strong>${name}</strong> wants access to your GoodWatch account. If you allow it, the app can read and change your GoodWatch marks. It can never see your password.</p>
<h2>Requested permissions</h2>
<ul>
${scopes}
</ul>
<p>Choosing Allow grants every permission listed above.</p>
<dl>
<dt>App ID</dt>
<dd><code>${escapeHtml(data.clientId)}</code></dd>
<dt>You will be sent back to</dt>
<dd><code>${escapeHtml(data.redirectUri)}</code></dd>
</dl>
<form method="post">
<button type="submit" name="decision" value="allow">Allow</button>
<button type="submit" name="decision" value="deny">Deny</button>
</form>`,
	)
}
