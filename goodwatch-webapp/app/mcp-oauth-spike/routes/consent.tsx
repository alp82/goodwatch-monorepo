import {
	json,
	redirect,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { verifyOAuthQueryParams } from "@better-auth/oauth-provider"
import { auth, audit, ready, postAuth } from "../auth.server"

async function verified(request: Request) {
	await ready
	const url = new URL(request.url)
	if (
		!(await verifyOAuthQueryParams(
			url.search.slice(1),
			(
				await auth.$context
			).secret,
		))
	)
		throw new Response("Invalid or expired consent query", { status: 400 })
	if (!(await auth.api.getSession({ headers: request.headers })))
		throw new Response("Sign in first", { status: 401 })
	return url
}
export async function loader({ request }: LoaderFunctionArgs) {
	const url = await verified(request)
	const clientId = url.searchParams.get("client_id")!
	const client = await auth.api.getOAuthClientPublic({
		query: { client_id: clientId },
		headers: request.headers,
	})
	return json({
		clientId,
		clientName: client.client_name,
		scope: url.searchParams.get("scope"),
		redirect: url.searchParams.get("redirect_uri"),
		query: url.search,
		claims: url.searchParams.get("claims"),
	})
}
export async function action({ request }: ActionFunctionArgs) {
	await verified(request)
	const accept = (await request.formData()).get("decision") === "allow"
	const response = await postAuth(request, "/oauth2/consent", {
		accept,
		oauth_query: new URL(request.url).search.slice(1),
	})
	if (response.status === 302) {
		audit("consent", {
			accept,
			clientId: new URL(request.url).searchParams.get("client_id"),
		})
		return response
	}
	if (!response.ok) return response
	const data = await response.json()
	audit("consent", {
		accept,
		clientId: new URL(request.url).searchParams.get("client_id"),
	})
	const headers = new Headers()
	for (const cookie of response.headers.getSetCookie())
		headers.append("Set-Cookie", cookie)
	return redirect(data.url, { headers })
}
export default function Consent() {
	const data = useLoaderData<typeof loader>()
	return (
		<main>
			<h1>Allow {data.clientName || data.clientId}?</h1>
			<p>
				This client will read fictional GoodWatch titles and the demo member's
				show progress.
			</p>
			<dl>
				<dt>Client</dt>
				<dd>{data.clientId}</dd>
				<dt>Scopes</dt>
				<dd>{data.scope}</dd>
				<dt>Return address</dt>
				<dd>{data.redirect}</dd>
				{data.claims && (
					<>
						<dt>Requested identity claims</dt>
						<dd>{data.claims}</dd>
					</>
				)}
			</dl>
			<form method="post" action={`/consent${data.query}`}>
				<button name="decision" value="allow">
					Allow
				</button>
				<button name="decision" value="deny">
					Deny
				</button>
			</form>
			<p>Throwaway spike; no production account or data.</p>
		</main>
	)
}
