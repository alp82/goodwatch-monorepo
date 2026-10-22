import { useEffect, useState } from 'react';
import Svg, { Path } from 'react-native-svg';
import { Animated, View } from 'react-native';
import type { PeerActivity } from '../../core/continuous/activity';
import type { GlowPerson } from './model';
import { peerColor } from './model';
import { GText, Icon, Press, native } from './theme';
import { useReducedMotion } from '../../components/ui';
export function Faces({
  people,
  activity,
  open,
}: {
  people: GlowPerson[];
  activity: Map<string, PeerActivity>;
  open: () => void;
}) {
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
      {people.slice(0, 5).map((p) => (
        <Avatar
          key={p.id}
          person={p}
          pulse={activity.get(p.id)?.pulse?.serverTime ?? 0}
          active={activity.has(p.id)}
        />
      ))}
      {people.length > 5 && <GText size={12}>+{people.length - 5}</GText>}
    </Press>
  );
}
function Avatar({ person, pulse, active }: { person: GlowPerson; pulse: number; active: boolean }) {
  const [y] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!pulse || reduced || person.self) return;
    const animation = Animated.sequence([
      Animated.timing(y, { toValue: -7, duration: 130, useNativeDriver: native }),
      Animated.spring(y, { toValue: 0, friction: 4, useNativeDriver: native }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [pulse, reduced, y, person.self]);
  return (
    <Animated.View
      accessibilityLabel={`${person.nickname}${person.self ? ', you' : ''}`}
      style={{
        transform: [{ translateY: y }],
        width: 34,
        height: 34,
        borderRadius: 17,
        borderColor: person.self || active ? peerColor(person.id) : '#ffffff26',
        shadowColor: peerColor(person.id),
        shadowOpacity: active ? 0.6 : 0,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
        borderWidth: 2,
        backgroundColor: '#292929',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: -2,
      }}
    >
      <GText size={13} bold color={peerColor(person.id)}>
        {person.nickname.slice(0, 1).toUpperCase()}
      </GText>
    </Animated.View>
  );
}
/** Purely decorative neutral motion. No received coordinates, answer direction or card identity. */
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
      {layer === 'front' && pulse > 0 && !reduced && (
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
