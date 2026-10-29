// The 404 page's TV: "CH 404 / No signal" over calm static. CH+ tunes through channels, one title each: first what
// the broken address probably meant, then popular titles. The Netflix and Prime Video keys keep the channels to that
// service; a second press lets go. OK opens the title on the screen. No hints on the screen.
import { useNavigate } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import type { Channel as TvChannel, ChannelsResponse } from "~/server/channels"
import { ChannelNumber, type Key, Remote, Ring, Room, type ServiceKey, Static, useRemoteKeys, useTvPower } from "./Room"

/** The first title's channel number: CH 404 is the broken address itself. */
const FIRST = 405

async function fetchChannels(path: string): Promise<ChannelsResponse | null> {
	const response = await fetch(`/api/channels?path=${encodeURIComponent(path)}`)
	return response.ok ? response.json() : null
}

/** The channels in tuning order: the guesses first, then the rest, each title once. */
export function channelList(data: ChannelsResponse | null | undefined, service: ServiceKey | null): TvChannel[] {
	if (!data) return []
	const rest = service === "netflix" ? data.netflix : service === "prime" ? data.prime : data.popular
	const restKeys = new Set(rest.map((channel) => channel.key))
	// With a service key down, a guess stays only when it is on that service.
	const guesses = service ? data.guesses.filter((guess) => restKeys.has(guess.key)) : data.guesses
	const seen = new Set<number>()
	return [...guesses, ...rest].filter((channel) => !seen.has(channel.key) && seen.add(channel.key))
}

export default function NotFoundTv({ path }: { path: string }) {
	const navigate = useNavigate()
	const { data } = useQuery({ queryKey: ["tv-channels", path], queryFn: () => fetchChannels(path) })
	const [service, setService] = useState<ServiceKey | null>(null)
	const list = useMemo(() => channelList(data, service), [data, service])
	const guesses = useMemo(() => new Set(data?.guesses.map((guess) => guess.key)), [data])
	// -1 is CH 404 itself.
	const [at, setAt] = useState(-1)
	const [flips, setFlips] = useState(0)
	const tv = useTvPower()
	const tune = (to: number) => {
		setAt(to)
		setFlips((n) => n + 1)
	}
	const press = (key: Key) => {
		if (key === "power") return tv.toggle()
		if (!tv.on) return
		if (key === "up" || key === "down") {
			const next = at + (key === "up" ? 1 : -1)
			tune(next < -1 ? list.length - 1 : next >= list.length ? -1 : next)
		}
		if (key === "ok" && at >= 0 && list[at]) navigate(list[at].url)
	}
	const pickService = (key: ServiceKey) => {
		setService((current) => (current === key ? null : key))
		tune(0)
	}
	useRemoteKeys(press)
	const channel = at >= 0 ? (list[at] ?? null) : null
	const label = service
		? service === "netflix"
			? "Netflix"
			: "Prime Video"
		: channel && guesses.has(channel.key)
			? "Did you mean"
			: "Popular now"
	return (
		<Room
			power={tv.power}
			screen={
				<>
					{channel ? (
						<>
							<img
								src={`https://image.tmdb.org/t/p/w1280${channel.backdrop}`}
								alt=""
								className="absolute inset-0 h-full w-full object-cover"
								draggable={false}
							/>
							<div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />
							<div className="tve-fade-in absolute inset-x-[3cqw] bottom-[4cqh] flex items-end gap-[2cqw]">
								<Ring score={channel.score} size="8cqw" />
								<div className="min-w-0 flex-1">
									<div className="truncate text-[4.2cqw] font-bold leading-tight">{channel.title}</div>
									<div className="mt-[0.5cqh] truncate text-[2.1cqw] text-white/70">
										{[channel.year, channel.mediaType === "movie" ? "Movie" : "Show"].filter(Boolean).join(" · ")}
									</div>
								</div>
							</div>
						</>
					) : (
						<Static opacity={0.55} />
					)}
					{flips > 0 && <Static flash={flips} opacity={0.75} />}
					<ChannelNumber n={channel ? FIRST + at : 404} label={channel ? label : "No signal"} />
				</>
			}
			remote={
				<Remote
					press={press}
					off={!tv.on}
					pulse={at === -1 && list.length > 0 ? "up" : undefined}
					services={Boolean(data)}
					openService={service}
					onService={pickService}
				/>
			}
		/>
	)
}
