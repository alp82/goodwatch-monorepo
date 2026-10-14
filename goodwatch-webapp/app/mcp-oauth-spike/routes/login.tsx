import {
	json,
	redirect,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from "@remix-run/node"
import { useActionData, useLoaderData } from "@remix-run/react"
import { postAuth, email, origin, ready, audit } from "../auth.server"

export async function loader({ request }: LoaderFunctionArgs) {
	await ready
	return json({ email, query: new URL(request.url).search })
}
export async function action({ request }: ActionFunctionArgs) {
	await ready
	const form = await request.formData()
	const query = new URL(request.url).search.slice(1)
	const body = {
		email,
		password: String(form.get("password")),
		callbackURL: `${origin}/`,
		...(query ? { oauth_query: query } : {}),
	}
	const result = await postAuth(request, "/sign-in/email", body)
	if (result.status === 302) {
		audit("login", { success: true })
		return result
	}
	if (!result.ok) {
		audit("login-failed", { status: result.status })
		return json(
			{
				error: "Sign-in failed. Use the password printed by npm run spike:mcp.",
			},
			{ status: 401 },
		)
	}
	const data = await result.json()
	audit("login", { success: true })
	const headers = new Headers()
	for (const cookie of result.headers.getSetCookie())
		headers.append("Set-Cookie", cookie)
	return redirect(data.url || "/", { headers })
}
export default function Login() {
	const data = useLoaderData<typeof loader>()
	const error = useActionData<typeof action>()
	return (
		<main>
			<h1>Sign in to the GoodWatch spike</h1>
			<p>
				Local demo member: {data.email}. Use the password printed in the
				terminal.
			</p>
			{error && <p role="alert">{error.error}</p>}
			<form method="post" action={`/login${data.query}`}>
				<label>
					Password{" "}
					<input
						name="password"
						type="password"
						required
						autoComplete="current-password"
					/>
				</label>
				<button type="submit">Sign in</button>
			</form>
		</main>
	)
}
