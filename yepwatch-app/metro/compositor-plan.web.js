// Web only, used by metro/animated-props.web.js: hands a running JS timing animation's transform/opacity frames to
// the browser (Web Animations API) so they run without a DOM write per frame.
//
// Animated on the web is driven from JavaScript: every frame computes each animated value and writes it to its
// element's inline style. A DOM write per frame per element means style recalculation on the main thread every
// frame, and anything watching the DOM (a MutationObserver) runs every frame too.
//
// Here, when an element's transform/opacity depend only on values that are either still or driven by a
// TimingAnimation (whose whole course is known: from, to, easing, start, duration), its next frames are sampled
// ahead (60 per second, the same values the JS frames would compute, through the same style resolution) and played
// by element.animate() as linear keyframes, a short window at a time. JavaScript keeps running the animation itself
// (listeners, callbacks and the values stay exactly as before); only the per-frame DOM write is skipped while the
// browser's animation shows the same frames. Anything unplanned (a setValue, a gesture, a spring, a new animation, a
// stop) ends the plan at once and the element gets the current value written, as before.
//
// The first frame of an animation and its last are still written to the element: what the page shows at those
// moments stays visible to anything reading the DOM, as before.

import AnimatedValue from 'react-native-web/dist/vendor/react-native/Animated/nodes/AnimatedValue';
import AnimatedInterpolation from 'react-native-web/dist/vendor/react-native/Animated/nodes/AnimatedInterpolation';
import AnimatedAddition from 'react-native-web/dist/vendor/react-native/Animated/nodes/AnimatedAddition';
import AnimatedMultiplication from 'react-native-web/dist/vendor/react-native/Animated/nodes/AnimatedMultiplication';
import AnimatedSubtraction from 'react-native-web/dist/vendor/react-native/Animated/nodes/AnimatedSubtraction';
import AnimatedDivision from 'react-native-web/dist/vendor/react-native/Animated/nodes/AnimatedDivision';
import AnimatedModulo from 'react-native-web/dist/vendor/react-native/Animated/nodes/AnimatedModulo';
import AnimatedNode from 'react-native-web/dist/vendor/react-native/Animated/nodes/AnimatedNode';
import TimingAnimation from 'react-native-web/dist/vendor/react-native/Animated/animations/TimingAnimation';

const FRAME_MS = 1000 / 60;
/** How far ahead one plan samples; the next one is made as it runs out (no DOM write). */
const WINDOW_MS = 500;
/** Renewed this long before the window ends, so the browser never holds the last keyframe. */
const RENEW_MS = 3 * FRAME_MS;
/** An interpolation with input points closer than this jumps. */
const STEP = 0.01;
/** Less than this left: not worth a plan. */
const MIN_MS = 3 * FRAME_MS;

/** The AnimatedValues a node reads, or null when it reads something that can't be sampled. */
function leavesOf(node, out) {
  if (node instanceof AnimatedValue) {
    // A value following another (Animated.event, tracking) or driven natively isn't a plain timing.
    if (node._tracking || node.__isNative) return null;
    out.add(node);
    return out;
  }
  if (node instanceof AnimatedInterpolation) {
    // A step (a jitter's jumps, an on/off switch at a threshold) can't be drawn as straight lines between
    // frames without showing in-between values: such curves keep their JS frames.
    const input = node._config && node._config.inputRange;
    if (!Array.isArray(input)) return null;
    for (let i = 1; i < input.length; i++) if (input[i] - input[i - 1] < STEP) return null;
    return leavesOf(node._parent, out);
  }
  if (node instanceof AnimatedAddition || node instanceof AnimatedMultiplication || node instanceof AnimatedSubtraction || node instanceof AnimatedDivision)
    return leavesOf(node._a, out) && leavesOf(node._b, out);
  if (node instanceof AnimatedModulo) return leavesOf(node._a, out);
  // Anything else (diffClamp keeps state between reads, colors, XY) is never sampled.
  return null;
}

/** The leaves of an AnimatedStyle's transform and opacity, or null. */
export function styleLeaves(style) {
  const out = new Set();
  const { transform, opacity } = style._style;
  if (opacity instanceof AnimatedNode && !leavesOf(opacity, out)) return null;
  if (transform instanceof AnimatedNode) {
    for (const t of transform._transforms) for (const key in t) if (t[key] instanceof AnimatedNode && !leavesOf(t[key], out)) return null;
  }
  return [...out];
}

/** A leaf's timing, when its course is fully known right now. */
function timingOf(leaf) {
  const a = leaf._animation;
  if (!(a instanceof TimingAnimation) || !a.__active || a._useNativeDriver || a._startTime === undefined || !(a._duration > 0)) return null;
  return a;
}
const at = (a, t) => a._fromValue + a._easing(Math.min(1, Math.max(0, (t - a._startTime) / a._duration))) * (a._toValue - a._fromValue);

/**
 * Sampling costs main-thread time: at most this much of it per frame goes into new plans. The frame a press
 * starts a dozen animations in is the busiest one; elements past the budget keep their JS frames and are planned
 * on a later frame.
 */
const BUDGET_MS = 1.5;
let budgetFrame = -1;
/** The frame each animation was first seen in. */
const firstSeen = new WeakMap();
let spent = 0;
/**
 * The current frame's start on the Date.now() clock the JS animations run on. Every plan maps the browser's
 * timeline to that clock the same way (in every frame, so a plan made later or renewed never steps back from
 * another one): an element shows the value of its frame's start, a JS frame the value of the moment its callback ran,
 * a fraction of a frame later.
 */
let frameDate = 0;
function budgetLeft() {
  const frame = document.timeline ? document.timeline.currentTime : null;
  if (frame == null) return false;
  if (frame !== budgetFrame) {
    budgetFrame = frame;
    spent = 0;
    frameDate = frame + (Date.now() - performance.now());
  }
  return spent < BUDGET_MS;
}

/** Plans by the animation they rely on, so stopping that animation ends them at once. */
const byAnimation = new Map();
const proto = TimingAnimation.prototype;
const stop = proto.stop;
const endPlans = (animation) => {
  const plans = byAnimation.get(animation);
  if (plans) for (const plan of [...plans]) plan.end(true);
};
proto.stop = function () {
  stop.call(this);
  endPlans(this);
};
// Finishing on its own (its last frame was written already) ends what still relies on it as well.
const ended = proto.__debouncedOnEnd;
proto.__debouncedOnEnd = function (result) {
  try {
    return ended.call(this, result);
  } finally {
    endPlans(this);
  }
};

/**
 * One element's plan: `resolve()` gives the element's current {transform, opacity} inline values (the same
 * resolution the direct write uses), `write()` writes the current values to the element.
 */
export class Plan {
  constructor(instance, leaves, resolve, write) {
    this.instance = instance;
    this.leaves = leaves;
    this.resolve = resolve;
    this.write = write;
    this.anim = null;
    this.timings = null;
    this.still = null;
    this.until = 0;
  }

  /** Makes (or renews) the plan from now on; false when the element's values can't be planned. */
  start() {
    if (!budgetLeft()) return false;
    const began = performance.now();
    // Sampled from the frame's start and started at it: plans made in one frame (one after another, however long
    // their sampling takes) show the same instant of every shared value.
    try { return this.plan(frameDate); } finally { spent += performance.now() - began; }
  }

  plan(now) {
    const timings = [];
    const still = [];
    let last = 0;
    for (const leaf of this.leaves) {
      const a = timingOf(leaf);
      if (a) {
        // Its first frame stays a JS frame (usually the press's own frame, the busiest one).
        if (!firstSeen.has(a)) firstSeen.set(a, budgetFrame);
        if (firstSeen.get(a) === budgetFrame) return false;
        timings.push([leaf, a]);
        last = Math.max(last, a._startTime + a._duration);
      }
      else if (leaf._animation) return false; // a spring, a decay, or a timing still in its delay
      else still.push([leaf, leaf._value, leaf._offset]);
    }
    // The real time too: a late callback (the course's last one) must not plan what is already over.
    if (!timings.length || last - Math.max(now, Date.now()) < MIN_MS) return false;
    const until = Math.min(last, now + WINDOW_MS);
    const keyframes = [];
    const saved = timings.map(([leaf]) => leaf._value);
    try {
      for (let t = now, done = false; !done; t += FRAME_MS) {
        if (t >= until) { t = until; done = true; }
        for (const [leaf, a] of timings) leaf._value = at(a, t);
        const v = this.resolve();
        const frame = { offset: (t - now) / (until - now) };
        if (v.transform !== undefined) frame.transform = v.transform;
        if (v.opacity !== undefined) frame.opacity = String(v.opacity);
        keyframes.push(frame);
      }
    } finally {
      timings.forEach(([leaf], i) => { leaf._value = saved[i]; });
    }
    keyframes[0].offset = 0;
    keyframes[keyframes.length - 1].offset = 1;
    const anim = this.instance.animate(keyframes, { duration: until - now, fill: 'forwards', easing: 'linear' });
    anim.startTime = budgetFrame;
    this.release();
    this.anim = anim;
    this.timings = timings;
    this.still = still;
    this.until = until;
    for (const [, a] of timings) {
      let set = byAnimation.get(a);
      if (!set) byAnimation.set(a, (set = new Set()));
      set.add(this);
    }
    return true;
  }

  /** The values still follow this plan at `now` (the frame needn't be written). */
  holds(now) {
    if (!this.anim) return false;
    for (const [leaf, a] of this.timings) if (leaf._animation !== a || !a.__active) return false;
    for (const [leaf, value, offset] of this.still) if (leaf._animation || leaf._value !== value || leaf._offset !== offset) return false;
    // The last frame of the course (or of this window) is the JS frame's again.
    return now < this.until - RENEW_MS;
  }

  /** The window is running out while the course goes on. */
  renewable(now) {
    if (!this.anim) return false;
    for (const [leaf, a] of this.timings) if (leaf._animation !== a || !a.__active) return false;
    for (const [leaf, value, offset] of this.still) if (leaf._animation || leaf._value !== value || leaf._offset !== offset) return false;
    return now >= this.until - RENEW_MS && this.timings.some(([, a]) => now < a._startTime + a._duration - MIN_MS);
  }

  release() {
    if (this.timings) for (const [, a] of this.timings) {
      const set = byAnimation.get(a);
      if (set) { set.delete(this); if (!set.size) byAnimation.delete(a); }
    }
    if (this.anim) this.anim.cancel();
    this.anim = null;
    this.timings = null;
    this.still = null;
  }

  /** Ends the plan; `write`: the element gets the current values (written before the browser's animation goes). */
  end(write) {
    if (!this.anim) return;
    if (write) this.write();
    this.release();
  }
}
