# Confirmation callback diagnosis

Production acceptance remains open. The inbox owner reports clicking the exact test signup confirmation and arriving logged in on the homepage. This report is preserved; it does not match the auth record observed by this session.

For the authorized fixture ending `20260919-0623`, repeated real production password sign-in returns HTTP 400 / `email_not_confirmed`. A direct request to the same Supabase project's auth endpoint returns `Email not confirmed`, ruling out stale frontend feedback. A scoped read of that exact account shows creation at 2026-09-19 06:21:31 UTC, a confirmation request at that time, and no email-confirmation or last-sign-in timestamp. Its scoped auth audit contains `user_confirmation_requested` only. No account fields were changed. The unused root environment references another project whose database hostname does not resolve; there is no evidence that it received this confirmation.

The exact confirmation failure is not established. Asked whether the homepage account was the test account or an existing account. Do not read personal browser sessions, request confirmation tokens, administratively confirm the account, or reset onboarding flags to claim acceptance.

## Reproduced feedback defect

Chrome DevTools: navigate production to `/` with a synthetic Supabase-style fragment containing `error=access_denied`, `error_code=otp_expired`, and an expiration description. The normal homepage renders with no visible error, while the error remains in the URL. This is a controlled reproduction of missing callback feedback, not a replay of the owner's actual confirmation link.

The fix renders a dismissible global alert for failed email/OAuth callbacks, including callbacks landing on discovery pages. It uses fixed text instead of echoing provider descriptions, removes only error parameters while preserving other URL state, and explains that an existing signed-in account does not establish confirmation of another account. Guests receive a link to Sign In, whose existing unconfirmed-account flow offers resend after submitting credentials.

## Local verification

Chrome DevTools, existing localhost:3003:

- Expired-link fragment displays the specific email-link warning and Sign In link.
- Alert fits desktop and 390px mobile viewport.
- Dismiss removes the alert without changing the retained `region=DE` parameter.
- Query-form callback errors display the generic warning, strip error parameters and retain `region=DE`; arbitrary provider text is not displayed.
- Normal navigation has no alert.
- Auth probe instrumentation was removed by reloading the production sign-in page.

Clean candidate production client and SSR build passed. No automated webapp tests were added per AGENTS.md. Contemporaneous clean-main and candidate TypeScript checks have identical 173 distinct file/message diagnostic signatures, with no new signature. Existing errors remain. The new-account transfer and actual confirmation acceptance remain outstanding; synthetic callback QA is not a successful signup claim.
