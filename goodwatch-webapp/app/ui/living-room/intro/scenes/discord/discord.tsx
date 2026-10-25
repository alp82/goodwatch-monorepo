// The Discord bot chapter. The headline alone, big on Discord's blurple; a Discord window rises over the picture and
// plays the /watch story (friends ask, /watch is typed, the command menu pops, GoodWatch answers). Then the window
// steps back to the lower left, the headline returns at the top left, and the pick card leaps out of the window to
// settle big and tilted on the right; its service button is pressed, reactions pop and two friends reply.
import { useFilmPhone } from "~/ui/living-room/intro/parts/film-phone"
import { Push } from "~/ui/living-room/intro/parts/push"
import type { SceneProps } from "~/ui/living-room/intro/scene"
import { BEAT, Channel, climbs } from "./channel"
import "./discord.css"
import { BurstCard, CARD_W, cardSpot } from "./ending"
import { EASE_IN_OUT, anim, withA } from "./kit"
import { replies } from "./replies"
import { Title } from "./title"

const RISE = 1300
const T0 = 1500
const SHRINK = T0 + BEAT.land + 600
const TITLE_BACK = SHRINK + 150
const BURST = SHRINK + 550
const BURST_DU = 950
const SERVICE = BURST + BURST_DU + 100
const REACT = SERVICE + 200
export const DISCORD_MS = 7300

// cqw. win: where the window ends (top-left, scale); box: the burst card's box.
const LAYOUT = {
	tv: {
		font: 2.5,
		title: 6.4,
		win: { left: 5, top: 19.5, s: 0.5 },
		box: { left: 56, top: 3.5, font: 1.5, compact: false, r: "2.5deg" },
	},
	phone: {
		font: 2.7,
		title: 5.6,
		win: { left: 3, top: 17, s: 0.46 },
		box: { left: 51.5, top: 3, font: 2.5, compact: true, r: "2.5deg" },
	},
}

export function DiscordBot({ data }: SceneProps) {
	const L = useFilmPhone() ? LAYOUT.phone : LAYOUT.tv
	const opts = { font: L.font, h: 56.25, t0: T0, cardW: CARD_W }
	const { list } = climbs(opts)
	const from = cardSpot(
		{ left: L.win.left, top: L.win.top, font: L.font * L.win.s },
		list[list.length - 1].to,
	)
	return (
		<Push
			from={BURST + BURST_DU - 200}
			dur={DISCORD_MS - (BURST + BURST_DU - 200)}
			scale={1.03}
			origin="70% 45%"
		>
			<div
				className="intro-dc intro-dc-blurple"
				aria-label="GoodWatch Discord bot: in a channel, someone types /watch and GoodWatch answers with a pick, its score and where to watch."
			>
				<div
					style={{
						position: "absolute",
						inset: 0,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<div
						{...withA(
							anim("push", 0, RISE + 200, { "--s": 1.06, "--ez": "linear" }),
						)}
					>
						<div {...withA(anim("back", RISE, 550, { "--ez": EASE_IN_OUT }))}>
							<Title
								className="center"
								style={{ fontSize: "10.5cqw", textAlign: "center" }}
							/>
						</div>
					</div>
				</div>
				<div style={{ position: "absolute", left: "5cqw", top: "3.2cqw" }}>
					<Title
						at={TITLE_BACK}
						step={180}
						style={{ fontSize: `${L.title}cqw` }}
						mark={false}
					/>
				</div>
				<div
					{...withA(
						anim("to", SHRINK, 650, {
							"--tx": `${L.win.left}cqw`,
							"--ty": `${L.win.top}cqw`,
							"--ts": L.win.s,
							"--ez": EASE_IN_OUT,
						}),
						"intro-dc-shrink",
					)}
				>
					<div
						{...withA(
							anim("slide", RISE, 600, {
								"--fy": "60cqw",
								"--ez": "cubic-bezier(.2,.8,.25,1)",
							}),
							"intro-dc-box",
							{ inset: 0 },
						)}
					>
						<Channel
							data={data}
							{...opts}
							after={replies(REACT - 150)}
							leaveAt={BURST}
							leaveDu={L.box.compact ? 200 : 100}
						/>
					</div>
				</div>
				<BurstCard
					data={data}
					box={L.box}
					from={from}
					at={BURST}
					du={BURST_DU}
					ez="cubic-bezier(.3,1.25,.4,1)"
					serviceAt={SERVICE}
					reactAt={REACT}
				/>
			</div>
		</Push>
	)
}
