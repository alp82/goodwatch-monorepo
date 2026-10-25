// The old Fingerprint tab of the Taste page, now a section of the one page.
import { redirect } from "@remix-run/node"

export const loader = () => redirect("/taste#fingerprint", 301)
