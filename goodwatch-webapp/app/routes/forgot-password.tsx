import type { LoaderFunction, LoaderFunctionArgs, MetaFunction, ActionFunction } from "@remix-run/node"
import { json } from "@remix-run/node"
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react"
import { useState } from "react"
import { toast } from "react-toastify"
import { createServerClient } from "@supabase/ssr"
import { parse, serialize } from "@supabase/ssr"
import { type PageMeta, buildMeta } from "~/utils/meta"

export function headers() {
	return {
		"Cache-Control": "max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	}
}

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
}

export const loader: LoaderFunction = async ({ request }: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const message = url.searchParams.get("message")

	return json({ message: message || undefined })
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
	const { message: loaderMessage } = useLoaderData<LoaderData>()
	const actionData = useActionData<typeof action>()
	const [email, setEmail] = useState("")
	const [isSubmitting, setIsSubmitting] = useState(false)

	const message = loaderMessage || actionData?.message
	const error = actionData?.error

	return (
		<div className="min-h-screen flex bg-gray-900">
			{/* Left side - Form */}
			<div className="flex-1 flex items-center justify-center p-8 lg:p-16">
				<div className="w-full max-w-md">
					<div className="text-center mb-8">
						<h1 className="text-4xl font-bold text-white mb-2">Forgot Password?</h1>
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
								className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
								placeholder="you@example.com"
							/>
						</div>

						<button
							type="submit"
							disabled={isSubmitting}
							className="w-full flex justify-center items-center px-4 py-3 bg-amber-700 hover:bg-amber-600 disabled:bg-gray-700 text-white font-semibold rounded-lg transition duration-200 disabled:cursor-not-allowed cursor-pointer"
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
			</div>

			{/* Right side - Imagery/Video */}
			<div className="hidden lg:block lg:flex-1 relative shadow-xl overflow-hidden">
				<div className="absolute inset-0 bg-gradient-to-br from-green-600/20 to-orange-600/20 z-10" />
				<img
					src="/images/hooks/sign-up-hook.png"
					alt="Movies and Shows"
					className="absolute inset-0 w-full h-full object-cover opacity-25"
				/>
				<div className="absolute inset-0 flex items-center justify-center z-20">
					<div className="text-center text-white p-8">
						<h2 className="text-5xl font-bold mb-8">
							Your Personal Movie Guide
						</h2>
						<p className="text-xl text-gray-200 max-w-md mx-auto">
							Track, rate, and discover your next favorite movies and shows all in one place.
						</p>
					</div>
				</div>
			</div>
		</div>
	)
}
