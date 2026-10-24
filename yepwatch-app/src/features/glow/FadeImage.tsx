import { useEffect, useState } from "react";
import { Animated, Platform, type ImageProps } from "react-native";
import { useReducedMotion } from "../../components/ui";
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
  const reduced = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => () => opacity.stopAnimation(), [opacity]);
  return (
    <Animated.Image
      {...props}
      style={[style, { opacity }]}
      onLoad={(event) => {
        if (reduced) opacity.setValue(1);
        else
          Animated.timing(opacity, {
            toValue: 1,
            duration: 240,
            useNativeDriver: Platform.OS !== "web",
          }).start();
        onLoad?.(event);
      }}
    />
  );
}
