import {
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from "react";
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
import { BootTarget } from "../home/boot-phase";
import { glow, s } from "./theme";
/** GoodWatch turn, arc and text timing; the same wordmark travels into the home header. */
export function Boot({
  ready,
  done,
  onLayout,
  onRevealed,
}: {
  ready: boolean;
  done: () => void;
  onLayout: () => void;
  onRevealed?: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const size = width < 360 ? 52 : 64;
  const reduced = useMotionPreference();
  const { target } = useContext(BootTarget);
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  }, [target]);
  const [lettersWidth, setLettersWidth] = useState(0);
  const [pop] = useState(() => new Animated.Value(0));
  const [reveal] = useState(() => new Animated.Value(0));
  const [arc] = useState(() => new Animated.Value(0));
  const [curtain] = useState(() => new Animated.Value(1));
  const [x] = useState(() => new Animated.Value(0));
  const [y] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(1));
  const [root, setRoot] = useState({ x: 0, y: 0, width, height });
  const container = useRef<ComponentRef<typeof View>>(null),
    wordWidth = useRef(0);
  useEffect(() => {
    if (!ready || !lettersWidth || reduced === null) return;
    if (reduced) {
      onRevealed?.();
      done();
      return;
    }
    const easing = Easing.bezier(0.22, 1, 0.36, 1);
    const timing = (value: Animated.Value, duration: number, toValue = 1) =>
      Animated.timing(value, {
        toValue,
        duration,
        easing,
        useNativeDriver: true,
      });
    const intro = Animated.parallel([
      Animated.sequence([Animated.delay(200), timing(pop, 1000)]),
      Animated.sequence([Animated.delay(1100), timing(reveal, 1000)]),
      Animated.sequence([Animated.delay(150), timing(arc, 1300)]),
    ]);
    let flight: Animated.CompositeAnimation | undefined;
    intro.start();
    const timer = setTimeout(() => {
      onRevealed?.();
      const to = targetRef.current;
      flight = Animated.parallel([
        timing(curtain, 500, 0),
        ...(to && wordWidth.current
          ? [
              timing(x, 700, to.x + to.width / 2 - root.x - root.width / 2),
              timing(y, 700, to.y + to.height / 2 - root.y - root.height / 2),
              timing(scale, 700, to.width / wordWidth.current),
            ]
          : []),
      ]);
      flight.start(({ finished }) => {
        if (finished) done();
      });
    }, 2400);
    return () => {
      clearTimeout(timer);
      intro.stop();
      flight?.stop();
    };
  }, [
    ready,
    lettersWidth,
    reduced,
    done,
    onRevealed,
    pop,
    reveal,
    arc,
    curtain,
    x,
    y,
    scale,
    root,
  ]);
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
      ref={container}
      testID="yepwatch-boot"
      accessibilityLabel="YepWatch is starting"
      onLayout={() => {
        onLayout();
        container.current?.measureInWindow((x, y, width, height) =>
          setRoot((old) =>
            old.x === x &&
            old.y === y &&
            old.width === width &&
            old.height === height
              ? old
              : { x, y, width, height }
          )
        );
      }}
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
            onLayout={(e) => {
              wordWidth.current = e.nativeEvent.layout.width;
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              transform: [{ translateX: x }, { translateY: y }, { scale }],
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
