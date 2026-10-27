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
import { BOOT, EASE_IN_OUT, EASE_OUT, bootSettleMs } from "../home/boot-timing";
import { glow, s } from "./theme";
/**
 * GoodWatch turn, arc and text timing, centered. Then the word grows a touch and dissolves in place
 * while the page builds in behind it (see boot-timing.ts). It never moves to another position, so
 * nothing depends on where the header lands on a given device. While the home page is not ready,
 * the amber arc keeps circling the Y.
 */
export function Boot({
  ready,
  pageReady,
  buildsIn,
  done,
  onLayout,
  onRevealed,
}: {
  ready: boolean;
  pageReady: boolean;
  buildsIn: boolean;
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
  const [curtain] = useState(() => new Animated.Value(1));
  const [exit] = useState(() => new Animated.Value(0));
  const [held, setHeld] = useState(false);
  const [capped, setCapped] = useState(false);
  const pageReadyRef = useRef(pageReady);
  useEffect(() => { pageReadyRef.current = pageReady; }, [pageReady]);
  const easing = Easing.bezier(...EASE_OUT);
  useEffect(() => {
    if (!ready || !lettersWidth || reduced === null) return;
    const quiet = reduced;
    const timing = (value: Animated.Value, duration: number) =>
      Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: true });
    const intro = Animated.parallel([
      Animated.sequence([Animated.delay(200), timing(pop, 1000)]),
      Animated.sequence([Animated.delay(1100), timing(reveal, 1000)]),
      Animated.sequence([Animated.delay(150), timing(arc, 1300)]),
    ]);
    if (quiet) { pop.setValue(1); reveal.setValue(1); } else intro.start();
    const timer = setTimeout(() => setHeld(true), quiet ? BOOT.quietHoldMs : BOOT.holdMs);
    return () => { clearTimeout(timer); intro.stop(); };
  }, [ready, lettersWidth, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  // Waiting on the page: keep the arc circling, and stop waiting after a bounded time.
  useEffect(() => {
    if (!held || pageReadyRef.current) return;
    const cap = setTimeout(() => setCapped(true), BOOT.pageWaitCapMs);
    const loop = reduced ? null : Animated.loop(Animated.timing(wait, { toValue: 1, duration: BOOT.waitLoopMs, easing: Easing.bezier(0.45, 0, 0.25, 1), useNativeDriver: true }));
    loop?.start();
    return () => { clearTimeout(cap); loop?.stop(); };
  }, [held, reduced, wait]);
  const leaving = held && (pageReady || capped);
  useEffect(() => {
    if (!leaving) return;
    const quiet = reduced === true;
    onRevealed?.();
    const dissolve = Animated.parallel([
      Animated.timing(exit, { toValue: 1, duration: quiet ? BOOT.word.quietExitMs : BOOT.word.exitMs, easing: Easing.bezier(...EASE_IN_OUT), useNativeDriver: true }),
      Animated.timing(curtain, { toValue: 0, duration: BOOT.curtainMs, useNativeDriver: true }),
    ]);
    dissolve.start();
    const timer = setTimeout(done, bootSettleMs(buildsIn, quiet));
    return () => { clearTimeout(timer); dissolve.stop(); };
    // One dissolve per boot: the inputs are fixed once it starts.
  }, [leaving]); // eslint-disable-line react-hooks/exhaustive-deps
  const quiet = reduced === true;
  // The word is fully transparent at `goneAt`, well before the header logo starts; its growth continues to the end.
  const wordOpacity = exit.interpolate({ inputRange: [0, quiet ? 1 : BOOT.word.goneAt, 1], outputRange: [1, 0, 0] });
  const wordScale = exit.interpolate({ inputRange: [0, 1], outputRange: [1, quiet ? 1 : BOOT.word.grow] });
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
  return (
    <View
      testID="yepwatch-boot"
      accessibilityLabel="YepWatch is starting"
      onLayout={onLayout}
      pointerEvents="none"
      style={[
        s.absolute,
        { zIndex: 100, alignItems: "center", justifyContent: "center" },
      ]}
    >
      <Animated.View
        style={[s.absolute, { backgroundColor: glow.bg, opacity: curtain }]}
      />
      {ready ? (
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
          <Animated.View
            style={{
              flexDirection: "row",
              alignItems: "center",
              opacity: wordOpacity,
              transform: [{ scale: wordScale }],
            }}
          >
            <View>
              <Animated.View
                style={{
                  opacity: pop,
                  transform: [
                    {
                      rotate: pop.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["-35deg", "0deg"],
                      }),
                    },
                    {
                      scale: pop.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.82, 1],
                      }),
                    },
                  ],
                }}
              >
                <Text style={type}>Y</Text>
              </Animated.View>
              <Animated.View
                style={{
                  position: "absolute",
                  left: -size * 0.34,
                  top: 0,
                  opacity: arc.interpolate({
                    inputRange: [0, 0.2, 0.8, 1],
                    outputRange: [0, 1, 1, 0],
                  }),
                  transform: [
                    {
                      rotate: arc.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["-120deg", "300deg"],
                      }),
                    },
                  ],
                }}
              >
                <Svg
                  width={size * 1.25}
                  height={size * 1.25}
                  viewBox="0 0 100 100"
                >
                  <Circle
                    cx="50"
                    cy="50"
                    r="46"
                    stroke={glow.amber}
                    strokeWidth="2.5"
                    strokeDasharray="72 217"
                    strokeLinecap="round"
                    fill="none"
                  />
                </Svg>
              </Animated.View>
              <Animated.View
                style={{
                  position: "absolute",
                  left: -size * 0.34,
                  top: 0,
                  opacity: wait.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] }),
                  transform: [{ rotate: wait.interpolate({ inputRange: [0, 1], outputRange: ["-120deg", "300deg"] }) }],
                }}
              >
                <Svg width={size * 1.25} height={size * 1.25} viewBox="0 0 100 100">
                  <Circle cx="50" cy="50" r="46" stroke={glow.amber} strokeWidth="2.5" strokeDasharray="72 217" strokeLinecap="round" fill="none" />
                </Svg>
              </Animated.View>
            </View>
            <View style={{ width: lettersWidth, overflow: "hidden" }}>
              <Animated.View
                style={{
                  opacity: reveal,
                  transform: [
                    {
                      translateX: reveal.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-lettersWidth * 0.45, 0],
                      }),
                    },
                  ],
                }}
              >
                {letters}
              </Animated.View>
            </View>
          </Animated.View>
        </>
      ) : (
        <Image
          source={require("../../../assets/splash-y.png")}
          style={{ width: 44, height: 44 }}
        />
      )}
    </View>
  );
}
