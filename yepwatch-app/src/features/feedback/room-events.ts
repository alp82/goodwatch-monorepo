import type { RoomSnapshot } from "@goodwatch/yepwatch-contracts/proposal";
import type { Feedback } from "./palette";
export function roomFeedback(
  previous: RoomSnapshot | undefined,
  next: RoomSnapshot
): Feedback[] {
  if (
    !previous ||
    previous.shared.roomId !== next.shared.roomId ||
    next.shared.revision <= previous.shared.revision
  )
    return [];
  const events: Feedback[] = [];
  const peers = (s: RoomSnapshot) =>
    new Set(
      s.shared.participants
        .filter((p) => p.participantId !== s.own.participantId && !p.dropped)
        .map((p) => p.participantId)
    );
  const before = peers(previous),
    after = peers(next);
  if ([...after].some((id) => !before.has(id))) events.push("join");
  if ([...before].some((id) => !after.has(id))) events.push("leave");
  if (previous.shared.phase !== "decided" && next.shared.phase === "decided")
    events.push("decided");
  if (previous.shared.phase !== "choosing" && next.shared.phase === "choosing")
    events.push("start");
  return events;
}
