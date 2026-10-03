import { ArrowRightCircleIcon } from "@heroicons/react/24/solid"
import { Link, useLocation } from "@remix-run/react"
import React, { useEffect, useState } from "react"
import { authReturnQuery } from "~/utils/auth-return"

type SignInButtonProps = {}

export const SignInButton = ({}: SignInButtonProps) => {
	const location = useLocation()
	const [redirectTo, setRedirectTo] = useState("")
	useEffect(() => {
		setRedirectTo(authReturnQuery(window.location))
	}, [location.pathname, location.search, location.hash])

	return (
		<Link
			rel="nofollow"
			to={`/sign-in/${redirectTo}`}
			className="
				w-full px-3 py-2
				flex items-center justify-center gap-2
				rounded-md
				bg-gray-100 hover:bg-white
				shadow-sm ring-2 ring-inset ring-gray-400 hover:ring-blue-500 focus-visible:ring-transparent
				font-semibold text-sm text-gray-900
			"
			prefetch="render"
		>
			<ArrowRightCircleIcon className="w-5 h-5" />
			Sign In
		</Link>
	)
}
