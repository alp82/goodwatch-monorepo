import { pickSound, type Feedback } from "./palette";
/** Short cues are disposable: no replay queue after backgrounding, mute or a trailer. */
export function makeSounds(driver: {
  active: () => boolean;
  play: (name: string) => void | Promise<void>;
  stop: () => void;
  save: (value: boolean) => void;
}) {
  let enabled = true,
    suspended = false,
    touched = false,
    dealUntil = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const selected = new Map<Feedback, string>(),
    last = new Map<Feedback, number>(),
    listeners = new Set<() => void>();
  const allowed = () => enabled && !suspended && driver.active();
  const stop = () => {
    clearTimeout(timer);
    dealUntil = 0;
    driver.stop();
  };
  const cue = (name: string) => {
    if (allowed()) {
      try {
        void Promise.resolve(driver.play(name)).catch(() => undefined);
      } catch {
        /* Audio must never block a room action. */
      }
    }
  };
  const playFeedback = (event: Feedback) => {
    if (!allowed()) return;
    const now = Date.now();
    if (event === "poster" && now < dealUntil) return;
    if (event === "swipe" && now - (last.get(event) ?? 0) < 450) return;
    last.set(event, now);
    const name = pickSound(event, selected.get(event));
    selected.set(event, name);
    cue(name);
  };
  return {
    cue,
    playFeedback,
    enabled: () => enabled,
    suspended: () => suspended,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setEnabled: (value: boolean) => {
      touched = true;
      enabled = value;
      if (!value) stop();
      driver.save(value);
      listeners.forEach((fn) => fn());
    },
    restore: (value: boolean) => {
      if (!touched) {
        enabled = value;
        listeners.forEach((fn) => fn());
      }
    },
    suspend: (value: boolean) => {
      suspended = value;
      if (value) stop();
    },
    stop,
    dealFirst: () => {
      if (!allowed()) return;
      clearTimeout(timer);
      playFeedback("start");
      dealUntil = Date.now() + 350;
      timer = setTimeout(() => {
        dealUntil = 0;
        playFeedback("poster");
      }, 350);
    },
  };
}
