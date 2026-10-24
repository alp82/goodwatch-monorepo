import { AppState } from "react-native";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";
import * as SecureStore from "expo-secure-store";
import { soundAssets, type SoundName } from "./assets";
import { makeSounds } from "./sound-controller";
import { volume } from "./palette";
const players = new Set<AudioPlayer>();
let active = AppState.currentState === "active";
const mode = setAudioModeAsync({
  playsInSilentMode: false,
  shouldPlayInBackground: false,
  interruptionMode: "mixWithOthers",
}).catch(() => undefined);
function stop() {
  for (const player of players) {
    player.pause();
    player.remove();
  }
  players.clear();
}
const sound = makeSounds({
  active: () => active,
  stop,
  play: async (name) => {
    await mode;
    if (!active || !sound.enabled() || sound.suspended() || players.size >= 4)
      return;
    const player = createAudioPlayer(soundAssets[name as SoundName]);
    players.add(player);
    player.volume = volume(name);
    const dispose = () => {
      if (players.delete(player)) player.remove();
    };
    player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) dispose();
    });
    player.play();
    setTimeout(dispose, 5000);
  },
  save: (value) => {
    void SecureStore.setItemAsync("yepwatch.sounds", String(value)).catch(
      () => undefined
    );
  },
});
void SecureStore.getItemAsync("yepwatch.sounds")
  .then((value) => sound.restore(value !== "false"))
  .catch(() => undefined);
AppState.addEventListener("change", (state) => {
  active = state === "active";
  if (!active) sound.stop();
});
export const {
  cue,
  playFeedback,
  dealFirst,
  setEnabled,
  subscribe,
  enabled: soundEnabled,
  suspend,
} = sound;
