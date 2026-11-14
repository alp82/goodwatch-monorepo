// Stands in for react-native-web's Animated/useAnimatedProps.js on the web (see metro.config.js).
//
// Upstream, every frame of a JS-driven animation (the only driver on the web) re-renders each animated
// component through React (`scheduleUpdate`), which resolves its whole style again and commits. A swipe
// or a vote animates a few dozen views at once, so that was a React commit on every frame.
//
// Here, a component whose animated values all sit in `style.transform` / `style.opacity` of a DOM
// element gets each frame's values written to that element's inline style directly, exactly as React
// would write them (the same StyleSheet resolution, the same setValueForStyles). React still owns the
// element: its next render computes the current values again and writes whatever differs from what it
// last wrote. Anything else animated (a color, a size, a non-style prop) keeps the upstream re-render.
//
// While such an element follows a timing animation, its frames are played by the browser instead
// (metro/compositor-plan.web.js): no inline write, so no style recalculation, per frame.
//
// Otherwise this is upstream react-native-web 0.21 useAnimatedProps.js unchanged.

'use strict';

import _objectSpread from '@babel/runtime/helpers/objectSpread2';
import AnimatedNode from 'react-native-web/dist/vendor/react-native/Animated/nodes/AnimatedNode';
import AnimatedProps from 'react-native-web/dist/vendor/react-native/Animated/nodes/AnimatedProps';
import AnimatedStyle from 'react-native-web/dist/vendor/react-native/Animated/nodes/AnimatedStyle';
import { AnimatedEvent } from 'react-native-web/dist/vendor/react-native/Animated/AnimatedEvent';
import useRefEffect from 'react-native-web/dist/vendor/react-native/Utilities/useRefEffect';
import NativeAnimatedHelper from 'react-native-web/dist/vendor/react-native/Animated/NativeAnimatedHelper';
import StyleSheet from 'react-native-web/dist/exports/StyleSheet';
import setValueForStyles from 'react-native-web/dist/modules/setValueForStyles';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import useLayoutEffect from 'react-native-web/dist/modules/useLayoutEffect';
import { Plan, styleLeaves } from './compositor-plan.web';

/** The props node's AnimatedStyle when transform/opacity are its only animated parts, else null. */
function directStyle(node) {
  let style = null;
  for (const key in node._props) {
    const value = node._props[key];
    if (!(value instanceof AnimatedNode)) continue;
    if (key !== 'style' || !(value instanceof AnimatedStyle)) return null;
    style = value;
  }
  if (!style) return null;
  // A nested style object (shadowOffset) gets its own entry even when nothing in it animates.
  for (const key in style._style) if (key !== 'transform' && key !== 'opacity' && animates(style._style[key])) return null;
  return style;
}
function animates(value) {
  if (value instanceof AnimatedNode) return true;
  if (value && typeof value === 'object') for (const key in value) if (animates(value[key])) return true;
  return false;
}

/** The current transform/opacity inline values of a direct style (what writeDirect writes). */
function resolveDirect(style) {
  const values = {};
  const { transform, opacity } = style._style;
  if (transform != null) values.transform = transform.__getValue();
  if (opacity != null) values.opacity = opacity.__getValue();
  const resolved = StyleSheet([values]);
  return (resolved && resolved[1]) || {};
}
/** Per direct style: the values its transform/opacity read (null: not plannable). */
const leavesCache = new WeakMap();
function leavesFor(style) {
  if (!leavesCache.has(style)) leavesCache.set(style, styleLeaves(style));
  return leavesCache.get(style);
}

/** What was last written directly to each element, so a frame that changes nothing writes nothing. */
const written = new WeakMap();
const isElement = (instance) => instance != null && instance.nodeType === 1 && instance.style != null;

/** Writes the current transform/opacity to the element; false when it can't (the caller re-renders). */
function writeDirect(instance, style) {
  if (!style || !isElement(instance)) return false;
  // Only these two: a static part resolved on its own (shadowOffset without its color) would write wrong CSS.
  const inline = resolveDirect(style);
  const last = written.get(instance);
  if (last && last.transform === inline.transform && last.opacity === inline.opacity) return true;
  written.set(instance, { transform: inline.transform, opacity: inline.opacity });
  setValueForStyles(instance, inline);
  return true;
}

/**
 * After a commit that followed direct writes: puts the element's transform/opacity back to what this
 * render resolves to (React only diffs against what it last wrote, not against the element), read from
 * the current animated values. A value now coming from a class, or gone, clears the inline one.
 */
function syncAfterCommit(instance, node) {
  if (!isElement(instance)) return;
  const resolved = StyleSheet([node.__getValue().style]);
  const inline = (resolved && resolved[1]) || {};
  setValueForStyles(instance, { transform: inline.transform ?? '', opacity: inline.opacity ?? '' });
}

export default function useAnimatedProps(props) {
  var _useReducer = useReducer(count => count + 1, 0),
    scheduleUpdate = _useReducer[1];
  var onUpdateRef = useRef(null);

  // TODO: Only invalidate `node` if animated props or `style` change. In the
  // previous implementation, we permitted `style` to override props with the
  // same name property name as styles, so we can probably continue doing that.
  // The ordering of other props *should* not matter.
  var node = useMemo(() => new AnimatedProps(props, () => onUpdateRef.current == null ? void 0 : onUpdateRef.current()), [props]);
  var direct = useMemo(() => directStyle(node), [node]);
  var instanceRef = useRef(null);
  var dirtyRef = useRef(false);
  useAnimatedPropsLifecycle(node);
  // Every commit: React wrote what it resolved; the element's direct-write record no longer holds, and
  // after direct writes the element is brought back in line with this render.
  useLayoutEffect(() => {
    const instance = instanceRef.current;
    if (instance != null) written.delete(instance);
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    syncAfterCommit(instance, node);
  });

  // TODO: This "effect" does three things:
  //
  //   1) Call `setNativeView`.
  //   2) Update `onUpdateRef`.
  //   3) Update listeners for `AnimatedEvent` props.
  //
  // Ideally, each of these would be separat "effects" so that they are not
  // unnecessarily re-run when irrelevant dependencies change. For example, we
  // should be able to hoist all `AnimatedEvent` props and only do #3 if either
  // the `AnimatedEvent` props change or `instance` changes.
  //
  // But there is no way to transparently compose three separate callback refs,
  // so we just combine them all into one for now.
  var refEffect = useCallback(instance => {
    // NOTE: This may be called more often than necessary (e.g. when `props`
    // changes), but `setNativeView` already optimizes for that.
    node.setNativeView(instance);
    instanceRef.current = instance;

    // A timing animation's frames played by the browser (compositor-plan.web.js), while they follow it.
    let plan = null;
    const leaves = direct && isElement(instance) && typeof instance.animate === 'function' ? leavesFor(direct) : null;
    // NOTE: This callback is only used by the JavaScript animation driver.
    onUpdateRef.current = () => {
      if (plan) {
        const now = Date.now();
        // The browser shows this frame already, or a new window of the same course takes over (no write either).
        if (plan.holds(now) || (plan.renewable(now) && plan.start())) {
          dirtyRef.current = true;
          return;
        }
        plan.end(false);
      }
      // Transform/opacity on a DOM element: written straight to it, no render.
      if (writeDirect(instance, direct)) {
        dirtyRef.current = true;
        if (leaves && leaves.length) {
          plan ??= new Plan(instance, leaves, () => resolveDirect(direct), () => writeDirect(instance, direct));
          plan.start();
        }
        return;
      }
      // Schedule an update for this component to update `reducedProps`,
      // but do not compute it immediately. If a parent also updated, we
      // need to merge those new props in before updating.
      scheduleUpdate();
    };
    var target = getEventTarget(instance);
    var events = [];
    for (var propName in props) {
      var propValue = props[propName];
      if (propValue instanceof AnimatedEvent && propValue.__isNative) {
        propValue.__attach(target, propName);
        events.push([propName, propValue]);
      }
    }
    return () => {
      // The element may stay (new props): its browser animation never outlives this node.
      if (plan) plan.release();
      onUpdateRef.current = null;
      for (var _i = 0, _events = events; _i < _events.length; _i++) {
        var _events$_i = _events[_i],
          _propName = _events$_i[0],
          _propValue = _events$_i[1];
        _propValue.__detach(target, _propName);
      }
    };
  }, [props, node, direct]);
  var callbackRef = useRefEffect(refEffect);
  return [reduceAnimatedProps(node), callbackRef];
}
function reduceAnimatedProps(node) {
  // Force `collapsable` to be false so that the native view is not flattened.
  // Flattened views cannot be accurately referenced by the native driver.
  return _objectSpread(_objectSpread({}, node.__getValue()), {}, {
    collapsable: false
  });
}

/**
 * Manages the lifecycle of the supplied `AnimatedProps` by invoking `__attach`
 * and `__detach`. However, this is more complicated because `AnimatedProps`
 * uses reference counting to determine when to recursively detach its children
 * nodes. So in order to optimize this, we avoid detaching until the next attach
 * unless we are unmounting.
 */
function useAnimatedPropsLifecycle(node) {
  var prevNodeRef = useRef(null);
  var isUnmountingRef = useRef(false);
  useEffect(() => {
    // It is ok for multiple components to call `flushQueue` because it noops
    // if the queue is empty. When multiple animated components are mounted at
    // the same time. Only first component flushes the queue and the others will noop.
    NativeAnimatedHelper.API.flushQueue();
  });
  useLayoutEffect(() => {
    isUnmountingRef.current = false;
    return () => {
      isUnmountingRef.current = true;
    };
  }, []);
  useLayoutEffect(() => {
    node.__attach();
    if (prevNodeRef.current != null) {
      var prevNode = prevNodeRef.current;
      // TODO: Stop restoring default values (unless `reset` is called).
      prevNode.__restoreDefaultValues();
      prevNode.__detach();
      prevNodeRef.current = null;
    }
    return () => {
      if (isUnmountingRef.current) {
        // NOTE: Do not restore default values on unmount, see D18197735.
        node.__detach();
      } else {
        prevNodeRef.current = node;
      }
    };
  }, [node]);
}
function getEventTarget(instance) {
  return typeof instance === 'object' && typeof (instance == null ? void 0 : instance.getScrollableNode) === 'function' ?
  // $FlowFixMe[incompatible-use] - Legacy instance assumptions.
  instance.getScrollableNode() : instance;
}
