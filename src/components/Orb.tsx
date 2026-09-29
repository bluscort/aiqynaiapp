import * as Haptics from 'expo-haptics';
import { useEffect, useId } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import type { Mood } from '@/lib/mascot';

interface MoodLook {
  core: [string, string, string];
  halo: string;
  haloEdge: string;
  outline: string;
  outlineWidth: number;
  highlight: number;
  /** Half-period of one breath, ms. */
  duration: number;
  glowOpacity: [number, number];
  glowScale: [number, number];
  coreScale: [number, number];
}

const LOOKS: Record<Mood, MoodLook> = {
  // Calm, vibrant breathing glow.
  happy: {
    core: ['#A5F3FC', '#6366F1', '#7C3AED'],
    halo: '#22D3EE',
    haloEdge: '#8B5CF6',
    outline: 'rgba(255,255,255,0.22)',
    outlineWidth: 1,
    highlight: 0.32,
    duration: 2400,
    glowOpacity: [0.5, 0.95],
    glowScale: [0.94, 1.1],
    coreScale: [0.97, 1.03],
  },
  // Faint, sluggish amber pulse.
  hungry: {
    core: ['#FDE68A', '#F59E0B', '#78350F'],
    halo: '#F59E0B',
    haloEdge: '#B45309',
    outline: 'rgba(253,230,138,0.25)',
    outlineWidth: 1,
    highlight: 0.2,
    duration: 4200,
    glowOpacity: [0.12, 0.34],
    glowScale: [0.97, 1.03],
    coreScale: [0.99, 1.01],
  },
  // Dim gray body, red outline, jitter.
  critical: {
    core: ['#52525B', '#27272A', '#0A0A0B'],
    halo: '#EF4444',
    haloEdge: '#3F3F46',
    outline: 'rgba(239,68,68,0.85)',
    outlineWidth: 2,
    highlight: 0.08,
    duration: 1700,
    glowOpacity: [0.04, 0.18],
    glowScale: [0.98, 1.02],
    coreScale: [1, 1],
  },
};

const THINKING_DURATION = 650;

interface OrbProps {
  mood: Mood;
  size?: number;
  /** Faster pulse while the AI is generating an answer. */
  thinking?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function Orb({ mood, size = 180, thinking = false, onPress, onLongPress }: OrbProps) {
  const look = LOOKS[mood];
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const pulse = useSharedValue(0);
  const jitter = useSharedValue(0);
  const press = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(pulse);
    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: thinking ? THINKING_DURATION : look.duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );

    cancelAnimation(jitter);
    jitter.value = 0;
    if (mood === 'critical') {
      jitter.value = withRepeat(
        withSequence(
          withTiming(-3, { duration: 40 }),
          withTiming(2.5, { duration: 40 }),
          withTiming(-1.5, { duration: 40 }),
          withTiming(1, { duration: 40 }),
          withTiming(0, { duration: 40 }),
          withDelay(900 + Math.random() * 600, withTiming(0, { duration: 1 })),
        ),
        -1,
        false,
      );
    }
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(jitter);
    };
  }, [mood, thinking, look.duration, pulse, jitter]);

  const glowStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(pulse.value, [0, 1], look.glowOpacity),
      transform: [{ scale: interpolate(pulse.value, [0, 1], look.glowScale) }],
    }),
    [mood],
  );

  const coreStyle = useAnimatedStyle(
    () => ({
      transform: [
        { translateX: jitter.value },
        { scale: interpolate(pulse.value, [0, 1], look.coreScale) * press.value },
      ],
    }),
    [mood],
  );

  const box = size * 1.9;
  const c = size / 2;

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      onLongPress={onLongPress}
      delayLongPress={600}
      onPressIn={() => (press.value = withSpring(0.9, { damping: 12 }))}
      onPressOut={() => (press.value = withSpring(1, { damping: 8 }))}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="button"
      accessibilityLabel={`Aiqyn: ${mood}`}
    >
      <Animated.View pointerEvents="none" style={[styles.center, { width: box, height: box }, glowStyle]}>
        <Svg width={box} height={box}>
          <Defs>
            <RadialGradient id={`${gid}h`} cx="50%" cy="50%" r="50%">
              <Stop offset="0.3" stopColor={look.halo} stopOpacity={0.85} />
              <Stop offset="0.6" stopColor={look.haloEdge} stopOpacity={0.3} />
              <Stop offset="1" stopColor={look.haloEdge} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={box / 2} cy={box / 2} r={box / 2} fill={`url(#${gid}h)`} />
        </Svg>
      </Animated.View>

      <Animated.View style={[{ width: size, height: size }, coreStyle]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id={`${gid}c`} cx="38%" cy="32%" r="78%">
              <Stop offset="0" stopColor={look.core[0]} />
              <Stop offset="0.55" stopColor={look.core[1]} />
              <Stop offset="1" stopColor={look.core[2]} />
            </RadialGradient>
          </Defs>
          <Circle
            cx={c}
            cy={c}
            r={c - look.outlineWidth}
            fill={`url(#${gid}c)`}
            stroke={look.outline}
            strokeWidth={look.outlineWidth}
            strokeDasharray={mood === 'critical' ? '6 5' : undefined}
          />
          <Ellipse cx={size * 0.37} cy={size * 0.28} rx={size * 0.17} ry={size * 0.09} fill="#FFFFFF" opacity={look.highlight} />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
