/** Monotonic, local observation only. Paused surfaces never accrue Yep latency.
 * Nothing in this clock reveals another person's title or choice.
 */
export class ActiveCardClock {
  private key: string | null = null;
  private since: number | null = null;
  private elapsed = new Map<string, number>();
  constructor(private readonly now: () => number = () => performance.now()) {}
  observe(key: string | null, visible: boolean) {
    this.pause();
    this.key = key;
    if (key && visible) this.since = this.now();
  }
  pause() {
    if (this.key && this.since !== null) {
      this.elapsed.set(
        this.key,
        (this.elapsed.get(this.key) ?? 0) + Math.max(0, this.now() - this.since)
      );
    }
    this.since = null;
  }
  read(key: string) {
    const running =
      this.key === key && this.since !== null ? Math.max(0, this.now() - this.since) : 0;
    const value = (this.elapsed.get(key) ?? 0) + running;
    return value > 0 ? Math.round(value) : null;
  }
  forget(key: string) {
    this.elapsed.delete(key);
    if (this.key === key) this.since = null;
  }
  reset() {
    this.pause();
    this.key = null;
    this.elapsed.clear();
  }
}
