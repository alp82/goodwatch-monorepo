# Search analytics

The user explicitly chose to retain Google Analytics automatic Site search and
history-based page views, including raw search terms and readable query URLs.
This is an intentional exception to the earlier telemetry restriction for GA.
No changes to the GA web-stream settings are required.

The app uses the standard GA configuration. The replacement manual page-view
component was removed to avoid duplicate collection. GA remains disabled on
localhost and 127.0.0.1 to exclude local verification traffic.

Search links retain the readable `q` value. PostHog and Sentry continue to
redact query values embedded in URLs and explicit `q`, `query`, and
`search_term` fields; the GA decision does not extend to those systems.

## Verification scope

The earlier sanitized manual-page-view checks describe a superseded approach.
The final implementation should queue only the standard GA bootstrap, with no
app-generated `page_view` events. Production collection is controlled by the
existing enhanced-measurement settings.
