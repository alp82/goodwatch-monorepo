import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";
import { useReducedMotion } from "../../components/ui";
export function SuccessHalo() {
  const quiet = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (quiet) return;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 1800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [quiet, progress]);
  if (quiet) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 20,
        backgroundColor: "#fbbf24",
        opacity: progress.interpolate({
          inputRange: [0, 0.25, 1],
          outputRange: [0, 0.22, 0],
        }),
      }}
    />
  );
}
