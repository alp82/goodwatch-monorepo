// The old You vs everyone tab of the Taste page, now a section of the one page.
import { redirect } from "@remix-run/node"

export const loader = () => redirect("/taste#everyone", 301)
