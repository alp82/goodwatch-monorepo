import { useEffect, useRef, useSyncExternalStore } from "react";
import type { RoomSnapshot } from "@goodwatch/yepwatch-contracts/proposal";
import { View } from "react-native";
import { GText, glow } from "../glow/theme";
import { Switch } from "../room/ui";
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
/** Sound effects on or off, as a switch row (Room page). */
export function SoundToggle() {
  const enabled = useSyncExternalStore(subscribe, soundEnabled, () => true);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 }}>
      <GText color={glow.soft} style={{ flex: 1 }}>Sound effects</GText>
      <Switch label="Sound effects" on={enabled} onPress={() => setEnabled(!enabled)} />
    </View>
  );
}
