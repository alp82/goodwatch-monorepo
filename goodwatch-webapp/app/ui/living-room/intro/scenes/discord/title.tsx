// The chapter's headline: the Discord mark, "GoodWatch" and the amber "Discord bot" on two lines, each word rising in
// on its own beat. Size it with font-size (cqw).
import type { CSSProperties } from "react"
import mark from "~/img/discord-mark-white.svg"
import { assetUrl } from "~/utils/asset-url"
import { anim, withA } from "./kit"

export function Title({
	at = 100,
	step = 230,
	mark: showMark = true,
	className = "",
	style,
}: {
	at?: number
	step?: number
	mark?: boolean
	className?: string
	style?: CSSProperties
}) {
	const w = (i: number, du = 750) =>
		withA(anim("in", at + i * step, du), "", { display: "inline-block" })
	return (
		<h2 className={`intro-dc-title ${className}`} style={style}>
			{showMark && (
				<img
					{...withA(anim("pop", at - 50, 550), "intro-dc-mark")}
					src={assetUrl(mark)}
					alt=""
				/>
			)}
			<span className="l">
				<span {...w(0)}>GoodWatch</span>
			</span>
			<span className="l">
				<span {...w(1)}>
					<em>Discord</em>
				</span>{" "}
				<span {...w(2)}>
					<em>bot</em>
				</span>
			</span>
		</h2>
	)
}
