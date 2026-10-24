import { useEffect, useRef, useState } from "react";
import { PanResponder, Platform, View } from "react-native";
import { BACK_EDGE, edgeBackComplete, edgeBackIntent } from "./edge-back";
/** Narrow edge target; card gestures, controls and vertical scrolling outside it remain untouched. */
export function EdgeBack({ back }: { back: () => void }) {
  // Android owns its system edge gesture. BackHandler / Modal.onRequestClose
  // route that event through the same contextual Back action exactly once.
  return Platform.OS === "android" ? null : <EdgeBackGesture back={back} />;
}
function EdgeBackGesture({ back }: { back: () => void }) {
  const latest = useRef(back);
  useEffect(() => {
    latest.current = back;
  }, [back]);
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      // Own only the reserved edge from touch-down; fast movement can leave this
      // narrow strip before a move-based responder has a chance to claim it.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => edgeBackIntent(g.dx, g.dy),
      onPanResponderRelease: (_, g) => {
        if (edgeBackComplete(g.dx, g.dy, g.vx)) latest.current();
      },
      onPanResponderTerminationRequest: () => false,
    })
  );
  return (
    <View
      testID="back-gesture-edge"
      {...responder.panHandlers}
      accessible={false}
      importantForAccessibility="no"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: BACK_EDGE,
        zIndex: 50,
      }}
    />
  );
}
