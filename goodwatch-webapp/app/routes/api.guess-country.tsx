import { fetchJsonWithBackendTimeout, timeoutSetting } from "../utils/backend-timeout.ts"
import type { LoaderFunction, LoaderFunctionArgs } from "@remix-run/node"
import { getClientIPAddress } from "remix-utils/get-client-ip-address"

async function getCountryByIP(ip: string | null) {
	if (ip) {
		try {
			const data = await fetchJsonWithBackendTimeout("IP country lookup", timeoutSetting("IP_COUNTRY_TIMEOUT_MS", 3000), `https://ipapi.co/${ip}/json/`)
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
