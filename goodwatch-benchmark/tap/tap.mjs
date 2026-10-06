// Runs inside the Lighthouse image, which holds Chromium and puppeteer-core. Answers one question per control of a
// title page: does a tap do something, and how long does that take? Every measurement is its own page load in a new
// browser (empty cache, no cookies) with a phone viewport, touch input, and a slowed CPU.
//
// Two modes per control:
//   early   The tap comes as soon as the page has painted and the control is in the document. A control outside
//           the first screen is brought into view with one jump, without a scroll gesture.
//   scroll  The page loads and settles. Then touch drags scroll to the control at a fling's pace, and the tap
//           follows the last drag at once.
//
// The page's scripts run, so analytics count each measurement as one page view. Requests that write are blocked.
//
// Settings come from the environment (bench.sh sets them). Each finished measurement is one JSON line on stdout,
// after a header line. Progress goes to stderr.
import { createRequire } from "node:module";

const require = createRequire(process.env.TAP_PUPPETEER_FROM || "/usr/local/lib/node_modules/lighthouse/");
const puppeteer = require("puppeteer-core");
const env = process.env;
const number = (name, fallback) => {
  const value = Number(env[name] ?? fallback);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a number`);
  return value;
};

const CONTROLS = {
  streaming_tab: "Streaming tab (the first offer type that isn't selected)",
  action_want: "Title action: Want to See",
  action_seen: "Title action: Mark as Seen",
  fingerprint_switch: "Fingerprint switcher (the first area's \"See all\" button)",
  episode_cell: "Episode cell (the first one of the grid)",
  cast_next: "Cast row: next arrow",
  related_tab: "Related tab (the first one that isn't selected)",
  related_next: "Related row: next arrow (the first row)",
  related_more: "Related list: the first \"more\" step (carousel prototype, list variant)",
  related_explore: "Related titles: \"Explore from here\" (carousel prototype, explore variant)",
};
// Controls that only a prototype variant has. They run only when TAP_CONTROLS names them.
const OPT_IN = ["related_more", "related_explore"];
const MODES = ["early", "scroll"];
const NETWORKS = {
  none: null,
  // Lighthouse's "slow 4G" for throttling in the browser: 150 ms round trip, 1.6 Mbit/s down, 750 kbit/s up.
  slow4g: { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
};
const VIEWPORT = { width: 412, height: 823, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true };
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// ---------------------------------------------------------------------------------------------------------------
// The part that runs in the page, from before its first script. It finds each control, says what the control's
// effect is, and notes the times of the tap and of the effect on the page's own clock.
//
// A control has: find() for the element to tap, begin(el) for what to remember before the tap, done(el, ctx) for
// "the effect is in the document now", and ready(el) for "script has taken this control over" (React has attached
// the node, or Swiper has started the row). ready is a diagnosis, not part of the result.
function pageLib(plan) {
  if (window !== window.top || window.__tap) return;
  const now = () => performance.now();
  const q = (selector, root = document) => [...root.querySelectorAll(selector)];
  const text = (el) => (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim();
  const describe = (el) => (el instanceof Element ? `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} "${text(el).slice(0, 40)}"` : String(el));
  const shown = (el) => el.getClientRects().length > 0;
  const reactReady = (el) => Object.keys(el).some((key) => key.startsWith("__reactProps$"));

  // A carousel row is a Swiper element with its two arrow buttons as direct children: previous, then next.
  const row = (selector) => q(selector).find((swiper) => swiper.querySelector(":scope > button"));
  const slides = (swiper) => q(":scope > .swiper-wrapper > .swiper-slide", swiper);
  const slideKey = (slide) => slide.querySelector("a[href]")?.getAttribute("href") || text(slide).slice(0, 60);
  const activeKey = (swiper) => {
    const active = slides(swiper).find((slide) => slide.classList.contains("swiper-slide-active"));
    return active ? slideKey(active) : null;
  };
  // Effect of an arrow: the row's active slide is another one than before the tap. A row that Swiper hasn't
  // started has no active slide, and starting makes the first slide active, so that doesn't count.
  const arrow = (selector) => ({
    find: () => row(selector)?.querySelector(":scope > button:last-of-type") ?? null,
    begin: (el) => {
      const swiper = el.parentElement;
      const first = slides(swiper)[0];
      return { rest: activeKey(swiper) ?? (first ? slideKey(first) : null) };
    },
    done: (el, ctx) => {
      const swiper = row(selector);
      const key = swiper ? activeKey(swiper) : null;
      return key != null && key !== ctx.rest;
    },
    ready: (el) => Boolean(el.parentElement?.classList.contains("swiper-initialized")),
  });
  // A native row (the carousel prototype): a scroll container with its two arrow buttons as its siblings. Effect of
  // an arrow: the container has scrolled. One inline script handles the arrows of every row from the first parse on.
  const nativeArrow = (scope) => {
    const next = () => document.querySelector(`${scope} [data-nrow] > button[data-nrow-dir="1"]`);
    const track = (el) => el?.parentElement?.querySelector(":scope > [data-nrow-track]") ?? null;
    return {
      find: next,
      begin: (el) => ({ left: track(el)?.scrollLeft ?? 0 }),
      done: (el, ctx) => {
        const row = track(el.isConnected ? el : next());
        return row != null && Math.abs(row.scrollLeft - ctx.left) > 4;
      },
      ready: () => Boolean(window.__gwRows),
    };
  };
  // The first of the kinds whose control is in the document. A page has one of them.
  const either = (...kinds) => {
    const pick = () => kinds.find((kind) => kind.find()) ?? kinds[0];
    return {
      find: () => pick().find(),
      begin: (el) => pick().begin?.(el) ?? {},
      done: (el, ctx) => pick().done(el, ctx),
      ready: (el) => pick().ready(el),
    };
  };
  // Effect of a toggle or tab: the button with the tapped one's name reports the state "true".
  const toggle = (selector, attribute, pick) => ({
    find: () => q(selector).find((el) => el.getAttribute(attribute) === "false" && (!pick || pick(el))) ?? null,
    begin: (el) => ({ name: text(el) }),
    done: (el, ctx) => q(selector).some((other) => other.getAttribute(attribute) === "true" && text(other) === ctx.name),
    ready: reactReady,
  });
  const controls = {
    streaming_tab: toggle('#streaming [role="tab"]', "aria-selected"),
    action_want: toggle("#overview button[aria-pressed]", "aria-pressed", (el) => text(el) === "Want to See"),
    // A signed-out visitor gets the sign-in prompt, whose code loads on this first press.
    action_seen: {
      find: () => q("#overview button[aria-pressed]").find((el) => text(el) === "Mark as Seen") ?? null,
      done: () => q('[role="dialog"]').some((dialog) => /sign in/i.test(dialog.textContent || "")),
      ready: reactReady,
    },
    // Effect: one of the six detail views of the fingerprint is displayed.
    fingerprint_switch: {
      find: () => document.querySelector('#fingerprint button[aria-label^="See all "]'),
      done: () => q('#fingerprint section[aria-label$=" in detail"]').some(shown),
      ready: reactReady,
    },
    // Effect: the episode's tip is in the document. The grid is in the document twice, and CSS displays one.
    episode_cell: {
      find: () => q('#episode-ratings [data-grid-layout] button[data-float-id^="ep-"]').find(shown) ?? null,
      done: () => document.querySelector('div[data-float-id^="ep-"][aria-hidden="true"]') != null,
      ready: reactReady,
    },
    cast_next: either(arrow("#actors_and_crew .swiper"), nativeArrow("#actors_and_crew")),
    // The tab row is a Swiper element too, without arrow buttons. In the prototype it is a native row.
    related_tab: toggle(
      "#related .swiper:not(:has(> button)) button[aria-pressed], #related [data-nrow]:not(:has(> button)) button[aria-pressed]",
      "aria-pressed",
    ),
    related_next: either(arrow("#related .swiper"), nativeArrow("#related")),
    // Effect: the <details> is open. The browser does that without script.
    related_more: {
      find: () => document.querySelector("#related details > summary"),
      done: (el) => Boolean(el.parentElement?.open),
      ready: () => true,
    },
    // Effect: the walk through similar titles is in the document with its first neighbors.
    related_explore: {
      find: () => document.querySelector("#related button[data-early-tap]"),
      done: () => document.querySelector('#related .px-orbit[aria-busy="false"]') != null,
      ready: reactReady,
    },
  };

  const T = (window.__tap = { fcp: null, armed: null });
  const signal = (message) => {
    try {
      window.__tapSignal(JSON.stringify(message));
    } catch {}
  };
  const frame = () => new Promise((done) => requestAnimationFrame(() => done()));
  // The part of the screen where a tap can land: below the sticky title header, above the bottom edge.
  const band = () => {
    const header = document.querySelector("[data-details-header]")?.getBoundingClientRect();
    const top = Math.min(Math.max(header ? header.bottom : 0, 0), innerHeight / 2) + 50;
    return { top, bottom: innerHeight - 70, vh: innerHeight };
  };

  // After a drag: waits until the scroll position has been the same for two frames in a row, and starts watching
  // for the effect when the control is in the band and a tap can reach it.
  T.afterScroll = async (id) => {
    let last = scrollY;
    for (let same = 0, frames = 0; same < 2 && frames < 90; frames++) {
      await frame();
      same = scrollY === last ? same + 1 : 0;
      last = scrollY;
    }
    const at = T.locate(id);
    if (at.found && at.hit && at.cy >= at.top && at.cy <= at.bottom) return { at, arm: T.arm(id) };
    return { at };
  };

  T.locate = (id) => {
    const el = controls[id]?.find();
    if (!el) return { found: false };
    const rect = el.getBoundingClientRect();
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      found: true,
      cy: rect.top + rect.height / 2,
      // Whether a tap on the control's center reaches the control. A section that still skips its layout answers
      // for everything inside it, and so does anything that lies on top of the control.
      hit: Boolean(top) && (el === top || el.contains(top)),
      ...band(),
      scroll_y: scrollY,
    };
  };

  // Notes the state before the tap and starts watching for the effect. Returns where to tap.
  T.arm = (id) => {
    const control = controls[id];
    const el = control?.find();
    if (!el) return { found: false };
    const ctx = control.begin ? control.begin(el) : {};
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const top = document.elementFromPoint(x, y);
    const hit = Boolean(top) && (el === top || el.contains(top));
    const current = () => (el.isConnected ? el : control.find());
    const isReady = () => {
      const node = current();
      return Boolean(node && control.ready(node));
    };
    const A = (T.armed = {
      el,
      current,
      isReady,
      name: text(el).slice(0, 80),
      armed_at: now(),
      effect_before_tap: Boolean(control.done(el, ctx)),
      ready_at_arm: isReady(),
      ready_at: null,
      effect_at: null,
      frame_at: null,
      tap: null,
      click: null,
    });
    if (A.ready_at_arm) A.ready_at = A.armed_at;
    const check = () => {
      if (A.effect_at != null || !control.done(el, ctx)) return;
      A.effect_at = now();
      if (A.ready_at == null && isReady()) A.ready_at = A.effect_at;
      observer.disconnect();
      requestAnimationFrame(() => {
        A.frame_at = now();
      });
      signal({ type: "effect" });
    };
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
    const timer = setInterval(() => {
      if (A.ready_at == null && isReady()) {
        A.ready_at = now();
        signal({ type: "ready" });
      }
      check();
      if (A.ready_at != null && A.effect_at != null) clearInterval(timer);
    }, 50);
    return { found: true, x, y, hit, covered_by: hit ? null : describe(top), scroll_y: scrollY };
  };

  // The first pointerdown and the first click after arming. timeStamp is when the browser got the input, and
  // `seen` is when the page's script ran for it: the difference is the time the main thread was busy.
  for (const type of ["pointerdown", "click"])
    window.addEventListener(
      type,
      (event) => {
        const A = T.armed;
        const key = type === "click" ? "click" : "tap";
        if (!A || A[key]) return;
        const target = event.target;
        const node = A.current();
        const onTarget = target instanceof Node && (A.el.contains(target) || Boolean(node?.contains(target)));
        A[key] = { t: event.timeStamp, seen: now(), on_target: onTarget, target: onTarget ? null : describe(target), ready: A.isReady() };
      },
      { capture: true, passive: true },
    );

  T.report = () => {
    const A = T.armed;
    const navigation = performance.getEntriesByType("navigation")[0];
    return {
      fcp_ms: T.fcp,
      dom_content_loaded_ms: navigation?.domContentLoadedEventEnd || null,
      load_ms: navigation?.loadEventEnd || null,
      now_ms: now(),
      armed: A && {
        name: A.name,
        armed_at: A.armed_at,
        effect_before_tap: A.effect_before_tap,
        ready_at_arm: A.ready_at_arm,
        ready_at: A.ready_at,
        effect_at: A.effect_at,
        frame_at: A.frame_at,
        tap: A.tap,
        click: A.click,
      },
    };
  };

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name !== "first-contentful-paint" || T.fcp != null) continue;
      T.fcp = entry.startTime;
      if (plan.mode === "early") early();
    }
  }).observe({ type: "paint", buffered: true });

  async function early() {
    const id = plan.control;
    if (!controls[id].find())
      await new Promise((done) => {
        const observer = new MutationObserver(() => {
          if (!controls[id].find()) return;
          observer.disconnect();
          done();
        });
        observer.observe(document, { subtree: true, childList: true });
        setTimeout(() => {
          observer.disconnect();
          done();
        }, plan.find_timeout_ms);
      });
    // A jump lands next to sections that skipped their layout and get their real height now, which moves the
    // control. Jump again until the control is in the band, a tap can reach it, and it stays where it is from one
    // frame to the next. After 30 frames the tap goes out anyway, and the result says what covered the control.
    let jumped = false;
    let last = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const at = T.locate(id);
      if (!at.found) break;
      const inBand = at.cy >= at.top && at.cy <= at.bottom;
      if (inBand && at.hit && !jumped) break;
      if (inBand && at.hit && last != null && Math.abs(at.cy - last) < 1) break;
      if (!inBand) {
        window.scrollTo({ top: scrollY + at.cy - at.vh / 2, behavior: "instant" });
        jumped = true;
      }
      last = inBand ? at.cy : null;
      await frame();
    }
    signal({ type: "armed", jumped, ...T.arm(id) });
  }
}

// ---------------------------------------------------------------------------------------------------------------

function settings() {
  const origin = (env.TAP_BASE_URL || "").replace(/\/+$/, "");
  if (!/^https?:\/\/[^/]+$/.test(origin)) throw new Error("TAP_BASE_URL must be an origin, such as https://example.org");
  const pages = (env.TAP_PAGES || "")
    .split(",")
    .filter(Boolean)
    .map((entry) => {
      const [label, path] = entry.split("=");
      if (!/^[a-z0-9_-]+$/.test(label || "") || !/^\/[^\s]*$/.test(path || "")) throw new Error(`Invalid page: ${entry}`);
      return { label, path };
    });
  if (!pages.length) throw new Error("TAP_PAGES must name at least one page, such as movie=/movie/603-the-matrix");
  const list = (name, all) => {
    const picked = (env[name] || "").split(",").filter(Boolean);
    for (const item of picked) if (!all.includes(item)) throw new Error(`Unknown entry in ${name}: ${item}. Known: ${all.join(", ")}`);
    return picked.length ? all.filter((item) => picked.includes(item)) : all.filter((item) => !OPT_IN.includes(item));
  };
  const network = env.TAP_NETWORK || "none";
  if (!(network in NETWORKS)) throw new Error(`TAP_NETWORK must be one of: ${Object.keys(NETWORKS).join(", ")}`);
  const runs = number("TAP_RUNS", 5);
  if (!Number.isInteger(runs) || runs < 1) throw new Error("TAP_RUNS must be a positive integer");
  const cpu = number("TAP_CPU", 4);
  if (cpu < 1) throw new Error("TAP_CPU must be 1 or more");
  return {
    origin,
    pages,
    controls: list("TAP_CONTROLS", Object.keys(CONTROLS)),
    modes: list("TAP_MODES", MODES),
    runs,
    cpu,
    network,
    // A tap without its effect after this time is a lost tap.
    timeout_ms: number("TAP_TIMEOUT_MS", 5000),
    // Scroll mode: the wait between the load event and the first drag.
    settle_ms: number("TAP_SETTLE_MS", 3000),
    // After a lost tap: how much longer to wait for script to take the control over, for the diagnosis.
    ready_wait_ms: number("TAP_READY_WAIT_MS", 10000),
    // Pace of a drag in CSS pixels per second.
    scroll_speed: number("TAP_SCROLL_SPEED", 8000) || 8000,
    resolve_ip: env.TAP_RESOLVE_IP || "",
    insecure_tls: env.TAP_INSECURE_TLS === "1",
    blocked: (env.TAP_BLOCKED_URL_PATTERNS ?? "*/api/og-image-warm* */api/update-* */api/poster-impressions*").split(/\s+/).filter(Boolean),
    user_agent:
      env.BROWSER_UA ||
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  };
}

// One touch drag at the configured pace. The events go out on a timer without waiting for the page's answer to
// each one, so that a slow page gets the same gesture as a fast one. The finger rests for a tenth of a second
// before it lifts, so the browser adds no fling and every run scrolls the same distance.
async function drag(client, fromY, toY, speed) {
  const x = VIEWPORT.width - 24;
  const interval = 16;
  const steps = Math.max(3, Math.round(((Math.abs(toY - fromY) / speed) * 1000) / interval));
  const sent = [client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: fromY }] })];
  for (let step = 1; step <= steps + 6; step++) {
    await sleep(interval);
    const y = fromY + ((toY - fromY) * Math.min(step, steps)) / steps;
    sent.push(client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] }));
  }
  sent.push(client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }));
  await Promise.all(sent);
}

// Each drag spends its first pixels before the browser starts to scroll.
const DRAG_SLOP = 18;

// Scrolls to the control the way a visitor flicks through a page: one drag after the other, without a look at the
// page in between. A control that is in view at the start gets scrolled away and back, so that every control is
// tapped right after a scroll. Sections that skip their layout have estimated heights, so the control can end up
// outside the part of the screen where a tap can land: then further drags correct that before the tap.
async function scrollToControl(page, client, control, config) {
  const inBand = (at) => at.cy >= at.top && at.cy <= at.bottom;
  let at = await page.evaluate((id) => window.__tap.locate(id), control);
  if (!at.found) return { arm: at, scroll: null };
  const started = Date.now();
  const startY = at.scroll_y;
  const reach = at.vh * 0.6;
  let drags = 0;
  // A positive distance moves the page down: the finger goes up.
  const run = async (total) => {
    let left = total;
    while (Math.abs(left) > 40 && drags < 80) {
      const distance = Math.sign(left) * Math.min(reach, Math.max(60, Math.abs(left) + DRAG_SLOP));
      const from = distance > 0 ? at.vh * 0.8 : at.vh * 0.2;
      await drag(client, from, from - distance, config.scroll_speed);
      drags += 1;
      left -= distance - Math.sign(distance) * DRAG_SLOP;
      await sleep(30);
    }
  };
  if (inBand(at)) {
    await run(3 * (reach - DRAG_SLOP));
    await run(-3 * (reach - DRAG_SLOP));
  } else {
    await run(at.cy - at.vh / 2);
  }
  let ended = Date.now();
  let corrections = 0;
  let arm = null;
  while (!arm) {
    // One call into the page: wait until the scroll position holds, look, and start watching when a tap can land.
    const after = await page.evaluate((id) => window.__tap.afterScroll(id), control);
    at = after.at;
    if (after.arm || !at.found) {
      arm = after.arm ?? at;
    } else if (corrections >= 8) {
      // Aim anyway. The result then says what the tap hit.
      arm = await page.evaluate((id) => window.__tap.arm(id), control);
    } else {
      corrections += 1;
      if (inBand(at)) {
        // In place but not reachable yet: its section is still being laid out.
        await sleep(50);
      } else {
        await run(at.cy - at.vh / 2);
        ended = Date.now();
      }
    }
  }
  return {
    arm,
    scroll: { drags, corrections, from_y: Math.round(startY), to_y: Math.round(arm.scroll_y ?? at.scroll_y ?? 0), ms: ended - started, ended },
  };
}

async function measure(config, target, control, mode) {
  const args = ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"];
  if (config.resolve_ip) args.push(`--host-resolver-rules=MAP ${new URL(config.origin).hostname} ${config.resolve_ip}`);
  if (config.insecure_tls) args.push("--ignore-certificate-errors");
  const result = { page: target.label, control, mode, status: "error", started_at: new Date().toISOString() };
  const browser = await puppeteer.launch({ executablePath: env.CHROME_PATH || "/usr/bin/chromium", args });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(config.user_agent);
    await page.setViewport(VIEWPORT);
    const client = await page.createCDPSession();
    await client.send("Network.enable");
    if (config.blocked.length) await client.send("Network.setBlockedURLs", { urls: config.blocked });
    if (NETWORKS[config.network]) await client.send("Network.emulateNetworkConditions", NETWORKS[config.network]);
    await client.send("Emulation.setCPUThrottlingRate", { rate: config.cpu });

    const errors = [];
    const sentWithBody = new Map();
    const note = (message) => {
      // A blocked request is this script's doing, not the page's.
      if (/ERR_BLOCKED_BY_CLIENT/.test(message)) return;
      if (errors.length < 20) errors.push(message.replace(/\s+/g, " ").slice(0, 300));
    };
    // Whose resource a message is about: the path on the page's own origin, the host name for others.
    const where = (address) => {
      try {
        const url = new URL(address);
        if (url.protocol !== "http:" && url.protocol !== "https:") return url.protocol.replace(":", "");
        return url.origin === config.origin ? url.pathname : url.hostname;
      } catch {
        return "";
      }
    };
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const from = /^Failed to load resource/.test(message.text()) ? where(message.location()?.url ?? "") : "";
      note(from ? `${message.text()} [${from}]` : message.text());
    });
    page.on("pageerror", (error) => note(String(error?.message ?? error)));
    // What the page requested after the tap, such as code that loads on first use: when it started and ended.
    let tapSent = null;
    const afterTap = new Map();
    client.on("Network.requestWillBeSent", (event) => {
      if (tapSent != null && afterTap.size < 12 && !afterTap.has(event.requestId))
        afterTap.set(event.requestId, { what: `${event.request.method} ${where(event.request.url)}`, start_ms: Date.now() - tapSent, end_ms: null, status: null });
      if (event.request.method === "GET") return;
      sentWithBody.set(event.requestId, { what: `${event.request.method} ${where(event.request.url)}`, blocked: false });
    });
    client.on("Network.responseReceived", (event) => {
      const row = afterTap.get(event.requestId);
      if (row) row.status = event.response.status;
    });
    client.on("Network.loadingFinished", (event) => {
      const row = afterTap.get(event.requestId);
      if (row) row.end_ms = Date.now() - tapSent;
    });
    client.on("Network.loadingFailed", (event) => {
      const row = sentWithBody.get(event.requestId);
      if (row && event.blockedReason) row.blocked = true;
      const later = afterTap.get(event.requestId);
      if (later) later.status = event.blockedReason ? "blocked" : "failed";
    });

    const waiting = { armed: [], effect: [], ready: [] };
    const seen = {};
    await page.exposeFunction("__tapSignal", (json) => {
      const message = JSON.parse(json);
      seen[message.type] = message;
      for (const done of waiting[message.type]?.splice(0) ?? []) done(message);
    });
    const signalled = (type, ms) =>
      seen[type] ? Promise.resolve(seen[type]) : Promise.race([new Promise((done) => waiting[type].push(done)), sleep(ms).then(() => null)]);
    await page.evaluateOnNewDocument(`(${pageLib})(${JSON.stringify({ control, mode, find_timeout_ms: 15000 })})`);

    const navigation = page.goto(config.origin + target.path, { waitUntil: "load", timeout: 60000 }).then(
      (response) => ({ status: response?.status() ?? null }),
      (error) => ({ error: error.message }),
    );
    let arm;
    if (mode === "early") {
      const first = await Promise.race([signalled("armed", 45000), navigation.then((nav) => (nav.error ? nav : new Promise(() => {})))]);
      if (first?.error) throw new Error(`Navigation failed: ${first.error}`);
      if (!first) throw new Error("The page didn't paint, or the control check didn't answer, within 45 seconds");
      arm = first;
    } else {
      const nav = await navigation;
      if (nav.error) throw new Error(`Navigation failed: ${nav.error}`);
      await sleep(config.settle_ms);
      const scrolled = await scrollToControl(page, client, control, config);
      arm = scrolled.arm;
      result.scroll = scrolled.scroll;
    }

    if (!arm.found) {
      result.status = "absent";
    } else {
      // Finger down and up go out together: a tap that waited for the page's answer in between would turn into a
      // long press when the main thread is busy.
      tapSent = Date.now();
      await Promise.all([
        client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: arm.x, y: arm.y }] }),
        client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }),
      ]);
      if (result.scroll) result.scroll.end_to_tap_ms = tapSent - result.scroll.ended;
      const effect = await signalled("effect", Math.max(0, config.timeout_ms - (Date.now() - tapSent)));
      // A lost tap: wait for script to take the control over, and then a little longer, to tell a tap that was
      // dropped from one whose effect is only late.
      if (!effect && (await signalled("ready", config.ready_wait_ms))) await signalled("effect", 3000);
      // A tap that lands on a link instead of the control can leave the page.
      const report = await page.evaluate(() => window.__tap.report()).catch(() => null);
      if (!report?.armed) throw new Error(`The document was gone after the tap${arm.hit ? "" : `; the control was covered by ${arm.covered_by}`}`);
      const A = report.armed;
      const round = (value) => (value == null ? null : Math.round(value));
      Object.assign(result, {
        name: A.name,
        jumped: arm.jumped ?? null,
        // What lay on top of the control's center when the tap was aimed, when it wasn't the control.
        covered_by: arm.covered_by ?? null,
        fcp_ms: round(report.fcp_ms),
        load_ms: round(report.load_ms),
        tap_at_ms: round(A.tap?.t),
        // How long the page's script took to see the tap: the main thread was busy for that long.
        input_delay_ms: A.tap ? round(A.tap.seen - A.tap.t) : null,
        // From the finger going down until the page's script saw the click that the tap turned into.
        click_delay_ms: A.tap && A.click ? round(A.click.seen - A.tap.t) : null,
        // The browser picks the click's element when it handles the tap. When the main thread was busy in between
        // and the layout moved, that is another element than the one under the finger: null without a click.
        click_on_target: A.click ? A.click.on_target : null,
        click_target: A.click && !A.click.on_target ? A.click.target : null,
        ready_at_tap: A.tap ? A.tap.ready : A.ready_at_arm,
        ready_ms: round(A.ready_at),
        effect_ms: null,
        frame_ms: null,
        // Set when the effect came after the limit: the tap counts as lost, but it wasn't dropped.
        late_effect_ms: null,
      });
      if (A.effect_before_tap) {
        result.status = "invalid";
        result.detail = "The effect was in the document before the tap";
      } else if (!A.tap || !A.tap.on_target) {
        // The tap went somewhere else. That is a fault of this check, not a lost tap.
        result.status = "missed";
        result.detail = A.tap ? `The tap hit ${A.tap.target}` : `The page saw no tap${arm.hit ? "" : `; the control was covered by ${arm.covered_by}`}`;
      } else if (A.effect_at != null && A.effect_at < A.tap.t) {
        result.status = "invalid";
        result.detail = "The effect came before the tap";
      } else if (A.click && !A.click.on_target) {
        // The finger was on the control, and the click went to another element, such as a link. Whatever the
        // document shows afterwards isn't the control's effect.
        result.status = "lost";
        result.detail = `The click landed on ${A.click.target}`;
      } else if (A.effect_at != null && A.effect_at - A.tap.t <= config.timeout_ms) {
        result.status = "effect";
        result.effect_ms = round(A.effect_at - A.tap.t);
        result.frame_ms = A.frame_at == null ? null : round(A.frame_at - A.tap.t);
      } else {
        result.status = "lost";
        if (A.effect_at != null) result.late_effect_ms = round(A.effect_at - A.tap.t);
      }
      result.requests_after_tap = [...afterTap.values()];
    }
    const nav = await Promise.race([navigation, sleep(100).then(() => ({ status: null, pending: true }))]);
    result.http_status = nav.status ?? null;
    if (nav.status && nav.status !== 200) result.detail = `${result.detail ? `${result.detail}. ` : ""}The page answered ${nav.status}`;
    result.console_errors = errors;
    result.react_errors = [...new Set(errors.flatMap((message) => [...message.matchAll(/Minified React error #(\d+)/g)].map((match) => Number(match[1]))))];
    // Requests other than GET: the ones that went out, and the ones this script blocked because they write.
    const withBody = [...sentWithBody.values()];
    result.requests_with_body = [...new Set(withBody.filter((row) => !row.blocked).map((row) => row.what))];
    result.blocked_requests = [...new Set(withBody.filter((row) => row.blocked).map((row) => row.what))];
  } catch (error) {
    result.status = "error";
    result.detail = String(error?.message ?? error).slice(0, 300);
  } finally {
    await browser.close().catch(() => {});
  }
  return result;
}

async function main() {
  const config = settings();
  const plan = [];
  for (let run = 1; run <= config.runs; run++)
    for (const target of config.pages)
      for (const control of config.controls) {
        // Movies have no episode grid.
        if (control === "episode_cell" && target.path.startsWith("/movie/")) continue;
        for (const mode of config.modes) plan.push({ run, target, control, mode });
      }
  const version = await (async () => {
    const browser = await puppeteer.launch({ executablePath: env.CHROME_PATH || "/usr/bin/chromium", args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      return await browser.version();
    } finally {
      await browser.close();
    }
  })();
  const { origin, resolve_ip: resolveIp, ...shown } = config;
  console.log(
    JSON.stringify({
      type: "header",
      schema: 1,
      started_at: new Date().toISOString(),
      browser: version,
      viewport: VIEWPORT,
      control_names: CONTROLS,
      planned: plan.length,
      config: { ...shown, resolve: Boolean(resolveIp) },
    }),
  );
  let count = 0;
  for (const { run, target, control, mode } of plan) {
    const result = { type: "measurement", run, ...(await measure(config, target, control, mode)) };
    console.log(JSON.stringify(result));
    count += 1;
    const time = result.status === "effect" ? ` ${result.effect_ms} ms` : "";
    console.error(`[${count}/${plan.length}] run ${run} ${target.label} ${control} ${mode}: ${result.status}${time}${result.detail ? ` (${result.detail})` : ""}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((error) => {
    console.error(error.message);
    process.exit(2);
  });
