import { useEffect, useRef, useSyncExternalStore } from "react";
import type { RoomSnapshot } from "@goodwatch/yepwatch-contracts/proposal";
import { Pill } from "../glow/theme";
import { roomFeedback } from "./room-events";
import {
  playFeedback,
  dealFirst,
  suspend,
  soundEnabled,
  setEnabled,
  subscribe,
} from "./sounds";
export function useRoomFeedback(
  snapshot: RoomSnapshot | undefined,
  trailerOpen: boolean
) {
  const previous = useRef<RoomSnapshot | undefined>(undefined);
  useEffect(() => {
    suspend(trailerOpen);
    return () => suspend(false);
  }, [trailerOpen]);
  useEffect(() => {
    if (!snapshot) return;
    const events = roomFeedback(previous.current, snapshot);
    previous.current = snapshot;
    for (const event of events) {
      if (event === "start") dealFirst();
      else playFeedback(event);
    }
  }, [snapshot]);
}
export function SoundToggle() {
  const enabled = useSyncExternalStore(subscribe, soundEnabled, () => true);
  return (
    <Pill
      label={`Sound effects ${enabled ? "on" : "off"}`}
      onPress={() => setEnabled(!enabled)}
    >
      Sound effects · {enabled ? "On" : "Off"}
    </Pill>
  );
}
