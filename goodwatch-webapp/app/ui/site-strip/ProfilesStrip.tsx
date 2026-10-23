// "GoodWatch has profiles now": for members whose handle predates profiles (domain/profile.ts owesProfilesStrip), on
// every page until they confirm Who sees what on Edit profile. No dismiss button (owner decision, 2026-10-23).
import { CONFIRM_VISIBILITY_PATH } from "~/domain/profile"
import { AccountAvatar } from "~/ui/account/AccountAvatar"
import { useAccountSummary } from "~/ui/account/useAccountSummary"
import { NewPill, SiteStripLink } from "./SiteStrip"

export function ProfilesStrip({ className }: { className?: string }) {
	const summary = useAccountSummary()
	if (!summary.profilesStrip) return null
	return (
		<SiteStripLink
			to={CONFIRM_VISIBILITY_PATH}
			className={className}
			lead={
				<AccountAvatar
					url={summary.avatarUrl}
					color={summary.color}
					initial={summary.initial}
					size={30}
				/>
			}
			title={
				<>
					<NewPill />
					<b>GoodWatch has profiles now.</b>
				</>
			}
			cta="Set up my profile"
		>
			Yours is ready with your favorites, scores and taste.
		</SiteStripLink>
	)
}
