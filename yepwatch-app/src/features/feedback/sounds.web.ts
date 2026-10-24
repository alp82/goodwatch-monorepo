import { soundAssets, type SoundName } from "./assets";
import { makeSounds } from "./sound-controller";
import { volume } from "./palette";
const voices = new Set<HTMLAudioElement>();
function stop() {
  voices.forEach((a) => {
    a.pause();
    a.removeAttribute("src");
    a.load();
  });
  voices.clear();
}
const sound = makeSounds({
  active: () => typeof document !== "undefined" && !document.hidden,
  stop,
  play: (name) => {
    if (voices.size >= 4) return;
    const source = soundAssets[name as SoundName];
    const audio = new Audio(typeof source === "string" ? source : source.uri);
    audio.volume = volume(name);
    voices.add(audio);
    audio.onended = audio.onerror = () => {
      voices.delete(audio);
    };
    void audio.play().catch(() => voices.delete(audio));
  },
  save: (value) => {
    try {
      localStorage.setItem("yepwatch.sounds", String(value));
    } catch {
      /* Session preference still applies. */
    }
  },
});
if (typeof window !== "undefined") {
  try {
    sound.restore(localStorage.getItem("yepwatch.sounds") !== "false");
  } catch {
    /* Defaults to quiet effects. */
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) sound.stop();
  });
}
export const {
  cue,
  playFeedback,
  dealFirst,
  setEnabled,
  subscribe,
  enabled: soundEnabled,
  suspend,
} = sound;
