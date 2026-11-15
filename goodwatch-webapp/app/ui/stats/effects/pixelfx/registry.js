// Every effect the stats page plays, by pixelfx id. Written by scripts/vendor-stats-fx.mjs.
import * as stats_die_tumble from "./fx/stats/die-tumble.js"
import * as stats_coin_slot from "./fx/stats/coin-slot.js"
import * as stats_coin_fountain from "./fx/stats/coin-fountain.js"
import * as cinema_glint from "./fx/cinema/glint.js"
import * as cinema_bookmark from "./fx/cinema/bookmark.js"
import * as cinema_stamp from "./fx/cinema/stamp.js"
import * as cinema_pun_crown from "./fx/cinema/pun-crown.js"
import * as cinema_pun_hearts from "./fx/cinema/pun-hearts.js"
import * as cinema_pun_holy from "./fx/cinema/pun-holy.js"
import * as cinema_amb_snow from "./fx/cinema/amb-snow.js"
import * as pickups_collect_burst from "./fx/pickups/collect-burst.js"
import * as explosions_firework_burst from "./fx/explosions/firework-burst.js"
import * as quiz_fizzle from "./fx/quiz/fizzle.js"
import * as stats_page_bar_snap from "./fx/stats-page/bar-snap.js"
import * as stats_page_bats from "./fx/stats-page/bats.js"
import * as stats_page_black_hole from "./fx/stats-page/black-hole.js"
import * as stats_page_clapper from "./fx/stats-page/clapper.js"
import * as stats_page_clash from "./fx/stats-page/clash.js"
import * as stats_page_coin_shower from "./fx/stats-page/coin-shower.js"
import * as stats_page_confetti_pop from "./fx/stats-page/confetti-pop.js"
import * as stats_page_fireworks from "./fx/stats-page/fireworks.js"
import * as stats_page_flashbulb from "./fx/stats-page/flashbulb.js"
import * as stats_page_hourglass from "./fx/stats-page/hourglass.js"
import * as stats_page_moonrise from "./fx/stats-page/moonrise.js"
import * as stats_page_night_bolt from "./fx/stats-page/night-bolt.js"
import * as stats_page_paper_planes from "./fx/stats-page/paper-planes.js"
import * as stats_page_popcorn_pop from "./fx/stats-page/popcorn-pop.js"
import * as stats_page_projector from "./fx/stats-page/projector.js"
import * as stats_page_shark_fin from "./fx/stats-page/shark-fin.js"
import * as stats_page_snowflake from "./fx/stats-page/snowflake.js"
import * as stats_page_splat from "./fx/stats-page/splat.js"
import * as stats_page_split_bar from "./fx/stats-page/split-bar.js"
import * as stats_page_spotlights from "./fx/stats-page/spotlights.js"
import * as stats_page_storm_cloud from "./fx/stats-page/storm-cloud.js"
import * as stats_page_sunrise from "./fx/stats-page/sunrise.js"
import * as stats_page_ticket from "./fx/stats-page/ticket.js"
import * as stats_page_trope_big_bad from "./fx/stats-page/trope-big-bad.js"
import * as stats_page_trope_bittersweet from "./fx/stats-page/trope-bittersweet.js"
import * as stats_page_trope_book_ends from "./fx/stats-page/trope-book-ends.js"
import * as stats_page_trope_chekhov from "./fx/stats-page/trope-chekhov.js"
import * as stats_page_trope_deadpan from "./fx/stats-page/trope-deadpan.js"
import * as stats_page_trope_downer from "./fx/stats-page/trope-downer.js"
import * as stats_page_trope_foreshadowing from "./fx/stats-page/trope-foreshadowing.js"
import * as stats_page_trope_meaningful_name from "./fx/stats-page/trope-meaningful-name.js"
import * as stats_page_trope_oh_crap from "./fx/stats-page/trope-oh-crap.js"
import * as stats_page_trope_running_gag from "./fx/stats-page/trope-running-gag.js"
import * as stats_page_trope_shout_out from "./fx/stats-page/trope-shout-out.js"
import * as stats_page_trope_title_drop from "./fx/stats-page/trope-title-drop.js"
import * as stats_page_trophy_shine from "./fx/stats-page/trophy-shine.js"
import * as stats_page_tv_static from "./fx/stats-page/tv-static.js"
import * as stats_page_zombie_hand from "./fx/stats-page/zombie-hand.js"
import * as stats_page_zzz from "./fx/stats-page/zzz.js"

export const EFFECTS = {
	"stats/die-tumble": stats_die_tumble,
	"stats/coin-slot": stats_coin_slot,
	"stats/coin-fountain": stats_coin_fountain,
	"cinema/glint": cinema_glint,
	"cinema/bookmark": cinema_bookmark,
	"cinema/stamp": cinema_stamp,
	"cinema/pun-crown": cinema_pun_crown,
	"cinema/pun-hearts": cinema_pun_hearts,
	"cinema/pun-holy": cinema_pun_holy,
	"cinema/amb-snow": cinema_amb_snow,
	"pickups/collect-burst": pickups_collect_burst,
	"explosions/firework-burst": explosions_firework_burst,
	"quiz/fizzle": quiz_fizzle,
	"stats-page/bar-snap": stats_page_bar_snap,
	"stats-page/bats": stats_page_bats,
	"stats-page/black-hole": stats_page_black_hole,
	"stats-page/clapper": stats_page_clapper,
	"stats-page/clash": stats_page_clash,
	"stats-page/coin-shower": stats_page_coin_shower,
	"stats-page/confetti-pop": stats_page_confetti_pop,
	"stats-page/fireworks": stats_page_fireworks,
	"stats-page/flashbulb": stats_page_flashbulb,
	"stats-page/hourglass": stats_page_hourglass,
	"stats-page/moonrise": stats_page_moonrise,
	"stats-page/night-bolt": stats_page_night_bolt,
	"stats-page/paper-planes": stats_page_paper_planes,
	"stats-page/popcorn-pop": stats_page_popcorn_pop,
	"stats-page/projector": stats_page_projector,
	"stats-page/shark-fin": stats_page_shark_fin,
	"stats-page/snowflake": stats_page_snowflake,
	"stats-page/splat": stats_page_splat,
	"stats-page/split-bar": stats_page_split_bar,
	"stats-page/spotlights": stats_page_spotlights,
	"stats-page/storm-cloud": stats_page_storm_cloud,
	"stats-page/sunrise": stats_page_sunrise,
	"stats-page/ticket": stats_page_ticket,
	"stats-page/trope-big-bad": stats_page_trope_big_bad,
	"stats-page/trope-bittersweet": stats_page_trope_bittersweet,
	"stats-page/trope-book-ends": stats_page_trope_book_ends,
	"stats-page/trope-chekhov": stats_page_trope_chekhov,
	"stats-page/trope-deadpan": stats_page_trope_deadpan,
	"stats-page/trope-downer": stats_page_trope_downer,
	"stats-page/trope-foreshadowing": stats_page_trope_foreshadowing,
	"stats-page/trope-meaningful-name": stats_page_trope_meaningful_name,
	"stats-page/trope-oh-crap": stats_page_trope_oh_crap,
	"stats-page/trope-running-gag": stats_page_trope_running_gag,
	"stats-page/trope-shout-out": stats_page_trope_shout_out,
	"stats-page/trope-title-drop": stats_page_trope_title_drop,
	"stats-page/trophy-shine": stats_page_trophy_shine,
	"stats-page/tv-static": stats_page_tv_static,
	"stats-page/zombie-hand": stats_page_zombie_hand,
	"stats-page/zzz": stats_page_zzz,
}
