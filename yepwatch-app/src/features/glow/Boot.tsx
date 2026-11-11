import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useMotionPreference } from "../../components/ui";
import { BOOT, EASE_OUT } from "../home/boot-timing";
import { glow, s } from "./theme";
/**
 * The startup cover (see boot-timing.ts). It continues the system splash (the Y on the dark ground)
 * and dissolves as soon as the page is ready. Only loading that takes longer shows the word: the Y
 * turns, the arc sweeps, "epWatch" slides in, then the arc keeps circling until the page is ready.
 */
export function Boot({
  ready,
  pageReady,
  word,
  done,
  onLayout,
  onRevealed,
}: {
  /** Fonts are in. */
  ready: boolean;
  pageReady: boolean;
  /** Slow loading may show the word (never on invitation links). */
  word: boolean;
  done: () => void;
  onLayout: () => void;
  onRevealed?: () => void;
}) {
  const { width } = useWindowDimensions();
  const size = width < 360 ? 52 : 64;
  const reduced = useMotionPreference();
  const [lettersWidth, setLettersWidth] = useState(0);
  const [pop] = useState(() => new Animated.Value(0));
  const [reveal] = useState(() => new Animated.Value(0));
  const [arc] = useState(() => new Animated.Value(0));
  const [wait] = useState(() => new Animated.Value(0));
  const [cover] = useState(() => new Animated.Value(1));
  const [slow, setSlow] = useState(false);
  const [held, setHeld] = useState(false);
  const [capped, setCapped] = useState(false);
  const leaving = ready && (pageReady || capped);
  const leavingRef = useRef(leaving);
  useEffect(() => { leavingRef.current = leaving; }, [leaving]);
  // The word comes only if the page is still loading after the delay; a dissolve already under way keeps the Y.
  const shownWord = word && slow && ready;
  const wordOn = shownWord && !leaving;
  // Both clocks count from the app's first frame.
  useEffect(() => {
    const later = setTimeout(() => { if (!leavingRef.current) setSlow(true); }, BOOT.wordDelayMs);
    const cap = setTimeout(() => setCapped(true), BOOT.pageWaitCapMs);
    return () => { clearTimeout(later); clearTimeout(cap); };
  }, []);
  const easing = Easing.bezier(...EASE_OUT);
  useEffect(() => {
    if (!wordOn || !lettersWidth || reduced === null) return;
    const timing = (value: Animated.Value, duration: number) =>
      Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: true });
    const intro = Animated.parallel([
      Animated.sequence([Animated.delay(200), timing(pop, 1000)]),
      Animated.sequence([Animated.delay(1100), timing(reveal, 1000)]),
      Animated.sequence([Animated.delay(150), timing(arc, 1300)]),
    ]);
    if (reduced) { pop.setValue(1); reveal.setValue(1); } else intro.start();
    const timer = setTimeout(() => setHeld(true), BOOT.introMs);
    return () => { clearTimeout(timer); intro.stop(); };
  }, [wordOn, lettersWidth, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  // Still loading after the intro: the arc keeps circling the Y.
  useEffect(() => {
    if (!held || leaving || reduced) return;
    const loop = Animated.loop(Animated.timing(wait, { toValue: 1, duration: BOOT.waitLoopMs, easing: Easing.bezier(0.45, 0, 0.25, 1), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [held, leaving, reduced, wait]);
  useEffect(() => {
    if (!leaving) return;
    onRevealed?.();
    // Loading that showed no word ends in a cut: the page is simply there.
    if (!shownWord) { done(); return; }
    const dissolve = Animated.timing(cover, { toValue: 0, duration: BOOT.dissolveMs, easing: Easing.linear, useNativeDriver: true });
    dissolve.start();
    const timer = setTimeout(done, BOOT.dissolveMs);
    return () => { clearTimeout(timer); dissolve.stop(); };
    // One dissolve per boot: the inputs are fixed once it starts.
  }, [leaving]); // eslint-disable-line react-hooks/exhaustive-deps
  const type = {
    fontFamily: "GabaritoBold",
    fontSize: size,
    lineHeight: size * 1.2,
    color: glow.ink,
    letterSpacing: -0.8,
  };
  const letters = (
    <Text numberOfLines={1} style={type}>
      ep<Text style={{ color: glow.amber }}>Watch</Text>
    </Text>
  );
  const ring = (value: Animated.Value) => (
    <Animated.View
      style={{
        position: "absolute",
        left: -size * 0.34,
        top: 0,
        opacity: value.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ rotate: value.interpolate({ inputRange: [0, 1], outputRange: ["-120deg", "300deg"] }) }],
      }}
    >
      <Svg width={size * 1.25} height={size * 1.25} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="46" stroke={glow.amber} strokeWidth="2.5" strokeDasharray="72 217" strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
  return (
    <Animated.View
      testID="yepwatch-boot"
      accessibilityLabel="YepWatch is starting"
      onLayout={onLayout}
      pointerEvents="none"
      style={[
        s.absolute,
        { zIndex: 100, alignItems: "center", justifyContent: "center", backgroundColor: glow.bg, opacity: cover },
      ]}
    >
      {shownWord ? (
        <>
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            aria-hidden
            style={{ position: "absolute", opacity: 0 }}
            onLayout={(e) =>
              setLettersWidth(Math.ceil(e.nativeEvent.layout.width) + 4)
            }
          >
            {letters}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View>
              <Animated.View
                style={{
                  opacity: pop,
                  transform: [
                    { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ["-35deg", "0deg"] }) },
                    { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
                  ],
                }}
              >
                <Text style={type}>Y</Text>
              </Animated.View>
              {ring(arc)}
              {ring(wait)}
            </View>
            <View style={{ width: lettersWidth, overflow: "hidden" }}>
              <Animated.View
                style={{
                  opacity: reveal,
                  transform: [{ translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [-lettersWidth * 0.45, 0] }) }],
                }}
              >
                {letters}
              </Animated.View>
            </View>
          </View>
        </>
      ) : (
        <Image
          source={require("../../../assets/splash-y.png")}
          style={{ width: 44, height: 44 }}
        />
      )}
    </Animated.View>
  );
}
