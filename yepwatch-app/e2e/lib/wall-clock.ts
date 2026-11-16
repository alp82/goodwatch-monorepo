/** Simulate elapsed suspension without replacing animation frames, performance or input timestamps. */
export function installWallClockOffset() {
  const NativeDate = Date;
  const nativeNow = NativeDate.now.bind(NativeDate);
  let offset = 0;
  const now = () => nativeNow() + offset;
  globalThis.Date = new Proxy(NativeDate, {
    construct(target, args) { return Reflect.construct(target, args.length ? args : [now()]); },
    apply() { return new NativeDate(now()).toString(); },
    get(target, key, receiver) { return key === 'now' ? now : Reflect.get(target, key, receiver); },
  });
  (window as unknown as { __ywAdvanceWallClock(ms: number): void }).__ywAdvanceWallClock = (ms) => { offset += ms; };
}
