// The old address of /shows. The fixed-depth routes are needed because the catch-all alone loses to
// $type.$category.$page and friends for paths up to three segments.
export { formerTvShowsLoader as loader } from "~/server/former-tv-shows.server"
