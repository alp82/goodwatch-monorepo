import type { LoaderFunction, LoaderFunctionArgs } from "@remix-run/node"
import { getClientIPAddress } from "remix-utils/get-client-ip-address"

async function getCountryByIP(ip: string | null) {
	if (ip) {
		const response = await fetch(`https://ipapi.co/${ip}/json/`)
		try {
			const data = await response.json()
			return data.country
		} catch {
			return null
		}
	}
	return null
}

export type LoaderData = {
	country: string
}

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const ip = getClientIPAddress(request)
	const countryFromIP = await getCountryByIP(ip)

	const acceptLanguage = request.headers.get("accept-language")
	let countryFromLocale = null
	if (acceptLanguage) {
		const locales = acceptLanguage.split(",")
		countryFromLocale = locales[0].split("-")[1]
	}

	const country = countryFromIP || countryFromLocale || 'US'

	return {
		country,
	}
}
