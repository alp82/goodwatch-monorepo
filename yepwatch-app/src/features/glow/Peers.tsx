import { useEffect, useState } from 'react';
import Svg, { Path } from 'react-native-svg';
import { Animated, View, useWindowDimensions } from 'react-native';
import type { PeerActivity } from '../../core/continuous/activity';
import type { GlowPerson } from './model';
import { peerColor } from './model';
import { GText, Icon, Press, native } from './theme';
import { useReducedMotion } from '../../components/ui';
export function Faces({
  people,
  activity,
  open,
  localReaction,
}: {
  people: GlowPerson[];
  activity: Map<string, PeerActivity>;
  open: () => void;
  localReaction: { at: number; gesture?: string; answer?: boolean };
}) {
  const limit = useWindowDimensions().width < 480 ? 3 : 5;
  return (
    <Press
      label={`Room, ${people.length} ${people.length === 1 ? 'person' : 'people'}`}
      onPress={open}
      style={{
        flexDirection: 'row',
        backgroundColor: 'transparent',
        borderWidth: 0,
        borderRadius: 30,
        paddingLeft: 0,
        paddingRight: 0,
        gap: 8,
      }}
    >
      {people.slice(0, limit).map((p) => (
        <Avatar
          key={p.id}
          person={p}
          pulse={
            p.self
              ? localReaction.at
              : activity.get(p.id)?.pointer?.serverTime ??
                activity.get(p.id)?.pulse?.serverTime ??
                0
          }
          action={
            p.self
              ? localReaction.answer !== undefined
                ? localReaction.answer
                  ? 'yep'
                  : 'nope'
                : localReaction.gesture
              : activity.get(p.id)?.pointer?.pointer
              ? activity.get(p.id)?.pointer?.pointer?.pressed
                ? 'reach'
                : 'handle'
              : activity.get(p.id)?.pulse?.beat
              ? 'answer'
              : activity.get(p.id)?.pulse?.gesture
          }
          moving={!!activity.get(p.id)?.pointer?.pointer}
          active={activity.has(p.id)}
        />
      ))}
      {people.length > limit && <GText size={12}>+{people.length - limit}</GText>}
    </Press>
  );
}
function Avatar({
  person,
  pulse,
  active,
  action,
  moving,
}: {
  person: GlowPerson;
  pulse: number;
  active: boolean;
  action?: string;
  moving: boolean;
}) {
  const [y] = useState(() => new Animated.Value(0)),
    [squash] = useState(() => new Animated.Value(1));
  const [spark] = useState(() => new Animated.Value(0)),
    [wiggle] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  useEffect(() => {
    y.stopAnimation();
    squash.stopAnimation();
    spark.stopAnimation();
    wiggle.stopAnimation();
    y.setValue(0);
    squash.setValue(1);
    spark.setValue(0);
    wiggle.setValue(0);
    if (reduced) return;
    if (action === 'reach') {
      Animated.spring(squash, {
        toValue: 0.72,
        useNativeDriver: native,
        friction: 6,
      }).start();
    } else if (action === 'answer' || action === 'yep') {
      Animated.sequence([
        Animated.timing(squash, {
          toValue: 0.8,
          duration: 75,
          useNativeDriver: native,
        }),
        Animated.parallel([
          Animated.spring(squash, {
            toValue: 1,
            useNativeDriver: native,
            friction: 4,
          }),
          Animated.sequence([
            Animated.timing(y, {
              toValue: -16,
              duration: 160,
              useNativeDriver: native,
            }),
            Animated.spring(y, {
              toValue: 0,
              useNativeDriver: native,
              friction: 4,
            }),
          ]),
          Animated.timing(spark, {
            toValue: 1,
            duration: 700,
            useNativeDriver: native,
          }),
        ]),
      ]).start();
    } else if (action === 'nope') {
      Animated.sequence([
        Animated.timing(wiggle, {
          toValue: -1,
          duration: 100,
          useNativeDriver: native,
        }),
        Animated.timing(wiggle, {
          toValue: 1,
          duration: 150,
          useNativeDriver: native,
        }),
        Animated.spring(wiggle, {
          toValue: 0,
          useNativeDriver: native,
          friction: 5,
        }),
      ]).start();
    } else if (moving || action === 'handle') {
      Animated.sequence([
        Animated.timing(wiggle, {
          toValue: 0.4,
          duration: 120,
          useNativeDriver: native,
        }),
        Animated.spring(wiggle, {
          toValue: 0,
          useNativeDriver: native,
          friction: 4,
        }),
      ]).start();
    }
    return () => {
      y.stopAnimation();
      squash.stopAnimation();
      spark.stopAnimation();
      wiggle.stopAnimation();
    };
  }, [pulse, action, moving, reduced, y, squash, spark, wiggle]);
  const color = peerColor(person.id);
  return (
    <View style={{ width: 44, height: 44 }}>
      <Animated.View
        accessibilityLabel={`${person.nickname}${person.self ? ', you' : ''}`}
        style={{
          width: 44,
          height: 44,
          borderRadius: 20,
          borderWidth: 2,
          borderColor: person.self || active ? color : '#ffffff26',
          backgroundColor: '#292929',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: color,
          shadowOpacity: active ? 0.6 : 0,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
          transform: [
            { translateY: y },
            { scaleY: squash },
            {
              scaleX: squash.interpolate({
                inputRange: [0.7, 1],
                outputRange: [1.18, 1],
              }),
            },
            {
              rotate: wiggle.interpolate({
                inputRange: [-1, 1],
                outputRange: ['-12deg', '12deg'],
              }),
            },
          ],
        }}
      >
        <GText size={17} bold color={color}>
          {person.nickname.slice(0, 1).toUpperCase()}
        </GText>
      </Animated.View>
      {[-1, 1].map((side) => (
        <Animated.View
          key={side}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: side < 0 ? 0 : 37,
            top: 0,
            opacity: spark.interpolate({
              inputRange: [0, 0.2, 1],
              outputRange: [0, 1, 0],
            }),
            transform: [
              {
                translateY: spark.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-4, -22],
                }),
              },
              {
                translateX: spark.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, side * 12],
                }),
              },
            ],
          }}
        >
          <GText size={13} color={color}>
            ✦
          </GText>
        </Animated.View>
      ))}
    </View>
  );
}
/** Ephemeral surface positions and neutral actions; never card identity or another person’s answer. */
export function PeerStage({
  activity,
  width,
  height,
  desktop,
  layer,
}: {
  activity: Map<string, PeerActivity>;
  width: number;
  height: number;
  desktop: boolean;
  layer: 'back' | 'front';
}) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        zIndex: layer === 'front' ? 3 : 0,
        width,
        height,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {[...activity.values()].slice(0, 3).map((a, i) => (
        <Ghost
          key={a.frame.participantId}
          peer={a}
          index={i}
          width={width}
          height={height}
          desktop={desktop}
          layer={layer}
        />
      ))}
    </View>
  );
}
function Ghost({
  peer,
  index,
  width,
  height,
  desktop,
  layer,
}: {
  peer: PeerActivity;
  index: number;
  width: number;
  height: number;
  desktop: boolean;
  layer: 'back' | 'front';
}) {
  const [beat] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  const pulse = peer.pulse?.serverTime ?? 0;
  useEffect(() => {
    beat.setValue(0);
    if (!pulse || reduced || layer !== 'front') return;
    const animation = Animated.timing(beat, {
      toValue: 1,
      duration: 1100,
      useNativeDriver: native,
    });
    animation.start();
    return () => animation.stop();
  }, [pulse, reduced, beat, layer]);
  const color = peerColor(peer.frame.participantId);
  return (
    <>
      {layer === 'back' && (
        <Animated.View
          style={{
            position: 'absolute',
            width: width * 0.65,
            height: height * 0.72,
            borderRadius: 23,
            borderWidth: 1,
            borderColor: color,
            backgroundColor: `${color}12`,
            opacity: 0.45,
            shadowColor: color,
            shadowOpacity: 0.45,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 0 },
            transform: [
              { translateX: width * (index % 2 ? 0.4 : -0.4) },
              { translateY: -9 - index * 5 },
              { rotate: `${index % 2 ? 11 : -11}deg` },
            ],
          }}
        >
          <Svg width="100%" height="100%" viewBox="0 0 100 150" preserveAspectRatio="none">
            <Path
              d="M0 15H100M0 30H100M0 45H100M0 60H100M0 75H100M0 90H100M0 105H100M0 120H100M0 135H100M15 0V150M30 0V150M45 0V150M60 0V150M75 0V150M90 0V150"
              stroke={color}
              strokeOpacity={0.28}
              strokeWidth={0.6}
            />
          </Svg>
        </Animated.View>
      )}
      {layer === 'front' && peer.frame.view === 'trailer' && (
        <View
          testID="peer-trailer-screen"
          style={{
            position: 'absolute',
            top: 16,
            left: index % 2 ? undefined : 12,
            right: index % 2 ? 12 : undefined,
            width: width * 0.36,
            height: width * 0.22,
            backgroundColor: `${color}33`,
            borderWidth: 1.5,
            borderColor: color,
            borderRadius: 10,
            opacity: 0.65,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: color,
            shadowOpacity: 0.5,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 0 },
          }}
        >
          <Icon name="play" color={color} size={25} />
        </View>
      )}
      {layer === 'front' && peer.pointer?.pointer && (
        <LivePointer peer={peer} width={width} height={height} />
      )}
      {layer === 'front' && !peer.pointer?.pointer && pulse > 0 && !reduced && (
        <Animated.View
          testID={desktop ? 'peer-cursor' : 'peer-touch'}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            opacity: beat.interpolate({
              inputRange: [0, 0.2, 0.75, 1],
              outputRange: [0, 0.55, 0.55, 0],
            }),
            transform: [
              {
                translateX: beat.interpolate({
                  inputRange: [0, 0.2, 0.4, 0.65, 1],
                  outputRange: desktop
                    ? [
                        width * 0.35,
                        width * 0.4,
                        width * (index % 2 ? 0.98 : -0.08),
                        width * (index % 2 ? 0.95 : -0.05),
                        width * 0.5,
                      ]
                    : [
                        width * (0.3 + index * 0.12),
                        width * (0.3 + index * 0.12),
                        width * (0.3 + index * 0.12),
                        width * (0.3 + index * 0.12),
                        width * (0.3 + index * 0.12),
                      ],
                }),
              },
              {
                translateY: beat.interpolate({
                  inputRange: [0, 0.3, 0.6, 1],
                  outputRange: desktop
                    ? [height * 0.55, height * 0.5, height * 0.4, height * 0.12]
                    : [height * 0.5, height * 0.48, height * 0.48, height * 0.45],
                }),
              },
            ],
          }}
        >
          {desktop ? (
            <Icon name="cursor" size={30} color={color} />
          ) : (
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: 3,
                borderColor: color,
                backgroundColor: `${color}55`,
              }}
            />
          )}
        </Animated.View>
      )}
    </>
  );
}

function LivePointer({
  peer,
  width,
  height,
}: {
  peer: PeerActivity;
  width: number;
  height: number;
}) {
  const position = peer.pointer!.pointer!;
  const [x] = useState(() => new Animated.Value(position.x * width));
  const [y] = useState(() => new Animated.Value(position.y * height));
  const reduced = useReducedMotion();
  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(x, {
        toValue: position.x * width,
        duration: reduced ? 0 : 260,
        useNativeDriver: native,
      }),
      Animated.timing(y, {
        toValue: position.y * height,
        duration: reduced ? 0 : 260,
        useNativeDriver: native,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [position.x, position.y, width, height, x, y, reduced]);
  const color = peerColor(peer.frame.participantId);
  return (
    <Animated.View
      testID="peer-live-pointer"
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        opacity: 0.55,
        transform: [{ translateX: x }, { translateY: y }, { scale: position.pressed ? 0.8 : 1 }],
      }}
    >
      {position.kind === 'mouse' ? (
        <Icon name="cursor" size={32} color={color} />
      ) : (
        <View
          style={{
            width: 26,
            height: 26,
            marginLeft: -13,
            marginTop: -13,
            borderRadius: 13,
            borderWidth: 3,
            borderColor: color,
            backgroundColor: `${color}55`,
          }}
        />
      )}
    </Animated.View>
  );
}
