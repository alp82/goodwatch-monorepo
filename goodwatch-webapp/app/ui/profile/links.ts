// The profile's addresses and the other profiles a member can link: each service's name, official logo where the app
// has one (the import sources' marks, used unchanged), the part of the address before the username, and the address.
import { LINK_SERVICES, type LinkService } from "~/domain/profile"
import { LINK_RULES, profileLinkUrl } from "~/domain/profile-settings"
import { IMPORT_SOURCE_LIST } from "~/ui/imports/ImportSources"

export { type ProfileTab, profileTabPath } from "./paths"

export const EDIT_PROFILE_PATH = "/settings/profile"

interface ServiceInfo {
	name: string
	/** The logo's build path; wrap it in assetUrl when rendering. */
	logo: string | null
	/** The letter on the tile of a service without a logo here. */
	letter: string
	prefix: string
	placeholder: string
	url: (value: string) => string
}

// A linked service that is also an import source shows the import source's logo.
const logoOf = (service: LinkService) =>
	IMPORT_SOURCE_LIST.find((source) => source.id === service)?.logo ?? null

/** Each service's rules (domain/profile-settings) with its logo, or the letter for its tile. */
export const LINK_SERVICE_INFO = Object.fromEntries(
	LINK_SERVICES.map((service) => {
		const rule = LINK_RULES[service]
		return [
			service,
			{
				name: rule.name,
				logo: logoOf(service),
				letter: rule.name.charAt(0),
				prefix: rule.prefix,
				placeholder: rule.placeholder,
				url: rule.url,
			},
		]
	}),
) as Record<LinkService, ServiceInfo>

export const linkUrl = profileLinkUrl
