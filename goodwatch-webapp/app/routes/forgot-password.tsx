import { authFetch } from "~/utils/auth-session"
import type { LoaderFunction, LoaderFunctionArgs, MetaFunction, ActionFunction } from "@remix-run/node"
import { json } from "@remix-run/node"
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react"
import { useState } from "react"
import { toast } from "react-toastify"
import { createServerClient } from "@supabase/ssr"
import { parse, serialize } from "@supabase/ssr"
import { type PageMeta, buildMeta } from "~/utils/meta"
import { getAuthPosters } from "~/server/auth-posters.server"
import { AUTH_INPUT_CLASS, AUTH_SUBMIT_CLASS, AuthScene } from "~/ui/auth/AuthScene"
import type { AuthPoster } from "~/ui/auth/PosterSpotlight"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Forgot Password | GoodWatch",
		description: "Reset your GoodWatch password",
		url: "https://goodwatch.app/forgot-password",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Forgot Password - GoodWatch",
	}

	return buildMeta({ pageMeta, items: [] })
}

export type LoaderData = {
	message?: string
	posters: AuthPoster[]
}

export const loader: LoaderFunction = async ({ request }: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const message = url.searchParams.get("message")

	return json({ message: message || undefined, posters: await getAuthPosters() })
}

export const action: ActionFunction = async ({ request }: LoaderFunctionArgs) => {
	const formData = await request.formData()
	const email = formData.get("email") as string

	if (!email) {
		return json({ error: "Please enter your email address" }, { status: 400 })
	}

	const cookies = parse(request.headers.get("Cookie") ?? "")
	const headers = new Headers()
	const supabase = createServerClient(
		process.env.SUPABASE_URL!,
		process.env.SUPABASE_ANON_KEY!,
		{
			global: { fetch: authFetch() },
			cookies: {
				get(key) {
					return cookies[key]
				},
				set(key, value, options) {
					headers.append("Set-Cookie", serialize(key, value, options))
				},
				remove(key, options) {
					headers.append("Set-Cookie", serialize(key, "", options))
				},
			},
		},
	)

	const { error } = await supabase.auth.resetPasswordForEmail(email, {
		redirectTo: `${new URL(request.url).origin}/reset-password`,
	})

	if (error) {
		return json({ error: error.message }, { status: 400 })
	}

	return json(
		{ message: "Check your email for a password reset link" },
		{
			headers,
		}
	)
}

export default function ForgotPassword() {
	const { posters, message: loaderMessage } = useLoaderData<LoaderData>()
	const actionData = useActionData<typeof action>()
	const [email, setEmail] = useState("")
	const [isSubmitting, setIsSubmitting] = useState(false)

	const message = loaderMessage || actionData?.message
	const error = actionData?.error

	return (
		<AuthScene posters={posters}>
			<div className="w-full">
				<div className="text-center mb-8">
					<h1 className="text-2xl font-bold text-white mb-2">Forgot Password?</h1>
					<p className="text-gray-400">
						No worries, we'll send you reset instructions.
					</p>
				</div>

				{message && (
					<div className="mb-6 p-4 bg-green-900/50 border border-green-700 rounded-lg">
						<p className="text-green-300 text-sm">{message}</p>
					</div>
				)}

				{error && (
					<div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg">
						<p className="text-red-300 text-sm">{error}</p>
					</div>
				)}

				<Form
					method="post"
					onSubmit={() => setIsSubmitting(true)}
					className="space-y-6"
				>
					<div>
						<label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
							Email address
						</label>
						<input
							id="email"
							name="email"
							type="email"
							autoComplete="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className={AUTH_INPUT_CLASS}
							placeholder="you@example.com"
						/>
					</div>

					<button
						type="submit"
						disabled={isSubmitting}
						className={AUTH_SUBMIT_CLASS}
					>
						{isSubmitting ? (
							<svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
								<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						) : (
							"Reset Password"
						)}
					</button>
				</Form>

				<div className="mt-8 text-center">
					<p className="text-gray-400">
						Remember your password?{" "}
						<Link to="/sign-in" className="text-amber-500 hover:text-amber-400 font-medium">
							Sign in
						</Link>
					</p>
				</div>
			</div>
		</AuthScene>
	)
}
