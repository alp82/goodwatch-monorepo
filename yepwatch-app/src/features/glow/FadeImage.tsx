import { useEffect, useState } from "react";
import { Animated, Platform, type ImageProps } from "react-native";
import { useMotionPreference } from "../../components/ui";
/** A new source starts transparent before loading; stale load events cannot reveal the next title. */
export function FadeImage(props: ImageProps) {
  const source = props.source;
  const key =
    source && typeof source === "object" && "uri" in source
      ? source.uri
      : String(source);
  return <LoadedImage key={key} {...props} />;
}
function LoadedImage({ style, onLoad, ...props }: ImageProps) {
  const reduced = useMotionPreference();
  const [loaded, setLoaded] = useState(false);
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    // Cached images can load before the native accessibility bridge answers.
    // An unknown preference must not reveal an opaque frame ahead of the fade.
    if (!loaded || reduced === null) return;
    if (reduced) {
      opacity.setValue(1);
      return;
    }
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 240,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [loaded, reduced, opacity]);
  return (
    <Animated.Image
      {...props}
      fadeDuration={0}
      style={[style, { opacity }]}
      onLoad={(event) => {
        setLoaded(true);
        onLoad?.(event);
      }}
    />
  );
}
