import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { REASSEMBLE_MS, type Splat, type SplatSide } from '@/hooks/useRagdoll';
import type { Mood } from '@/lib/mascot';

type Palette = { id: string; main: string; deep: string; shine: number };

const PALETTES: Record<Mood, Palette> = {
  happy: { id: 'slimeHappy', main: '#22D3EE', deep: '#8B5CF6', shine: 0.6 },
  hungry: { id: 'slimeHungry', main: '#F59E0B', deep: '#D97706', shine: 0.35 },
  critical: { id: 'slimeCritical', main: '#EF4444', deep: '#991B1B', shine: 0.3 },
};

const DRIP_MS = 2500;
const SPLAT_W = 76;
const SPLAT_H = 28;
/** The splat is drawn sitting on the floor; other edges are the same shape turned around. */
const SPLAT_TURN: Record<SplatSide, string> = { floor: '0deg', ceiling: '180deg', left: '90deg', right: '-90deg' };

/** The puddle's centre sits this far above the bottom of the stage. */
const FLOOR_INSET = 12;
const PUDDLE_W = 150;
const PUDDLE_H = 26;
/** The puddle's canvas is wider than the puddle to fit the side droplets. */
const PUDDLE_VIEW_W = 190;
const PUDDLE_VIEW_H = 28;
const FALL_MS = 900;
/** Share of FALL_MS one drop spends in the air; the rest is the spread of start delays. */
const FALL_SPAN = 0.7;

type DropSpec = {
  r: number;
  /** Landing spot, px from the puddle's centre. */
  land: number;
  /** Height of the hop on the way down. */
  arc: number;
  /** Start delay as a share of FALL_MS. */
  delay: number;
  /** Sideways swing of the arc on the way back up. */
  bulge: number;
  /** Extra drops rise out of the puddle and only take part in the reassembly. */
  extra?: boolean;
};

const DROPS: DropSpec[] = [
  { r: 14, land: -18, arc: 46, delay: 0, bulge: -60 },
  { r: 9, land: 34, arc: 70, delay: 0.06, bulge: 84 },
  { r: 6, land: -54, arc: 30, delay: 0.14, bulge: -116 },
  { r: 11, land: 8, arc: 58, delay: 0.04, bulge: 42 },
  { r: 7, land: 58, arc: 38, delay: 0.2, bulge: 124 },
  { r: 12, land: -36, arc: 64, delay: 0.1, bulge: -92 },
  { r: 8, land: 22, arc: 0, delay: 0, bulge: 24, extra: true },
  { r: 10, land: -6, arc: 0, delay: 0, bulge: -30, extra: true },
];

function clamp01(v: number) {
  'worklet';
  return Math.max(0, Math.min(1, v));
}

/** Keeps the puddle and its side droplets inside the stage walls. */
function puddleCentre(puddleX: number, stageWidth: number) {
  'worklet';
  const limit = Math.max(0, stageWidth / 2 - PUDDLE_VIEW_W / 2);
  return Math.max(-limit, Math.min(limit, puddleX));
}

function SlimeFill({ palette }: { palette: Palette }) {
  return (
    <Defs>
      <LinearGradient id={palette.id} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={palette.main} />
        <Stop offset="1" stopColor={palette.deep} />
      </LinearGradient>
    </Defs>
  );
}

/** A blob stuck to a stage edge with a strand of slime creeping down from it. */
function SplatMark({ splat, palette, stageH }: { splat: Splat; palette: Palette; stageH: SharedValue<number> }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: DRIP_MS, easing: Easing.linear });
  }, [t]);

  const { x, y, side } = splat;
  const strength = Math.min(1, splat.impact / 2500);
  const size = 0.55 + 0.45 * strength;
  const w = SPLAT_W * size;
  const h = SPLAT_H * size;
  // The blob sits on its edge and bulges into the stage.
  const cx = side === 'left' ? x + h / 2 : side === 'right' ? x - h / 2 : x;
  const cy = side === 'floor' ? y - h / 2 : side === 'ceiling' ? y + h / 2 : y;

  const drips = side !== 'floor';
  const strandW = Math.max(4, 7 * size);
  const headR = 3.5 + 3 * size;
  const dripX = side === 'left' ? x + h * 0.3 : side === 'right' ? x - h * 0.3 : x;
  const dripY = side === 'ceiling' ? y + h * 0.6 : y + 2;
  const dripLength = 50 + 50 * strength;

  const fade = useAnimatedStyle(() => ({ opacity: 0.85 * (1 - t.value * t.value) }));
  const blob = useAnimatedStyle(() => {
    const pop = Math.min(1, t.value / 0.06);
    const grown = 0.4 + 0.6 * pop * (2 - pop);
    // On the floor there is nowhere to drip, so the blob spreads out flat instead.
    const spread = drips ? 0 : t.value;
    const scaleY = grown * (1 - 0.4 * spread);
    return {
      // The shift keeps the base glued to the edge while the blob changes height.
      transform: [{ translateY: (h * (1 - scaleY)) / 2 }, { scaleX: grown * (1 + 0.35 * spread) }, { scaleY }],
    };
  });
  const strand = useAnimatedStyle(() => {
    // The strand stops at the floor instead of running through it.
    const reach = Math.max(0, Math.min(dripLength, stageH.value / 2 - dripY - headR * 2));
    const slide = 1 - (1 - t.value) * (1 - t.value);
    const stretch = Math.max(0.001, (reach * slide) / dripLength);
    return {
      transform: [
        { translateY: (-dripLength * (1 - stretch)) / 2 },
        { scaleX: 1 - 0.45 * slide },
        { scaleY: stretch },
      ],
    };
  });
  const head = useAnimatedStyle(() => {
    const reach = Math.max(0, Math.min(dripLength, stageH.value / 2 - dripY - headR * 2));
    const slide = 1 - (1 - t.value) * (1 - t.value);
    return { transform: [{ translateY: reach * slide }, { scaleY: 1 + 0.25 * slide }] };
  });

  return (
    <Animated.View style={[styles.anchor, fade]}>
      {drips && (
        <>
          <Animated.View
            style={[
              styles.anchor,
              {
                left: dripX - strandW / 2,
                top: dripY,
                width: strandW,
                height: dripLength,
                borderRadius: strandW / 2,
                backgroundColor: palette.main,
              },
              strand,
            ]}
          />
          <Animated.View style={[styles.anchor, { left: dripX - headR, top: dripY - headR * 1.3 }, head]}>
            <Svg width={headR * 2} height={headR * 2.6} viewBox="0 0 20 26">
              <SlimeFill palette={palette} />
              <Path d="M10 0 C10 8 19 12 19 17 A9 9 0 1 1 1 17 C1 12 10 8 10 0 Z" fill={`url(#${palette.id})`} />
              <Circle cx={7} cy={16} r={2} fill="#FFFFFF" opacity={palette.shine} />
            </Svg>
          </Animated.View>
        </>
      )}
      <View style={[styles.anchor, { left: cx - w / 2, top: cy - h / 2, transform: [{ rotate: SPLAT_TURN[side] }] }]}>
        <Animated.View style={blob}>
          <Svg width={w} height={h} viewBox={`0 0 ${SPLAT_W} ${SPLAT_H}`}>
            <SlimeFill palette={palette} />
            <Path
              d="M8 28 C8 20 14 17 20 18 C22 8 34 4 40 10 C48 6 58 12 56 19 C62 19 68 23 68 28 Z"
              fill={`url(#${palette.id})`}
            />
            <Ellipse cx={3.5} cy={25.5} rx={3} ry={2.5} fill={palette.main} />
            <Ellipse cx={73} cy={25} rx={2.5} ry={2.5} fill={palette.main} />
            <Ellipse cx={33} cy={12} rx={7} ry={2.2} fill="#FFFFFF" opacity={palette.shine} />
          </Svg>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

type BurstGeometry = {
  puddleX: number;
  hitX: number;
  hitY: number;
  stageW: SharedValue<number>;
  stageH: SharedValue<number>;
};

/** One drop: it flies from the hit point down to the puddle, then back up to the stage centre. */
function Drop({
  spec,
  palette,
  fall,
  gather,
  puddleX,
  hitX,
  hitY,
  stageW,
  stageH,
}: BurstGeometry & { spec: DropSpec; palette: Palette; fall: SharedValue<number>; gather: SharedValue<number> }) {
  const { r } = spec;
  const style = useAnimatedStyle(() => {
    // The back easing lets `g` dip below 0 and overshoot 1; `gc` is the same progress kept in range.
    const g = gather.value;
    const gc = clamp01(g);
    const landX = puddleCentre(puddleX, stageW.value) + spec.land;
    const landY = stageH.value / 2 - FLOOR_INSET - spec.r * 0.2;
    const tau = spec.extra ? 1 : clamp01((fall.value - spec.delay) / FALL_SPAN);
    const fallX = hitX + (landX - hitX) * tau;
    const fallY = hitY + (landY - hitY) * tau * tau - spec.arc * 4 * tau * (1 - tau);
    // A landed drop sags into the puddle until it is pulled back up.
    const sag = clamp01((tau - 0.85) / 0.15) * (1 - clamp01(g * 4));
    // Drops swell as they merge, then collapse into the point the orb pops out of.
    const merge = (1 + 0.35 * gc) * (1 - clamp01((gc - 0.85) / 0.15));
    const size = (spec.extra ? clamp01(g * 4) : clamp01(tau * 8)) * merge;
    return {
      transform: [
        { translateX: fallX * (1 - g) + spec.bulge * 4 * gc * (1 - gc) },
        { translateY: fallY * (1 - g) },
        { scaleX: size * (1 + 0.25 * sag) },
        { scaleY: size * (1 - 0.35 * sag) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.anchor, { left: -r, top: -r }, style]}>
      <Svg width={r * 2} height={r * 2}>
        <SlimeFill palette={palette} />
        <Circle cx={r} cy={r} r={r} fill={`url(#${palette.id})`} />
        <Ellipse cx={r * 0.68} cy={r * 0.58} rx={r * 0.3} ry={r * 0.2} fill="#FFFFFF" opacity={palette.shine} />
      </Svg>
    </Animated.View>
  );
}

/** The burst after the melting hit: drops rain into a puddle, then everything flies back to the centre. */
function MeltBurst({
  palette,
  reassembling,
  ...geometry
}: BurstGeometry & { palette: Palette; reassembling: boolean }) {
  const { puddleX, stageW, stageH } = geometry;
  const fall = useSharedValue(0);
  const grow = useSharedValue(0);
  const pulse = useSharedValue(0);
  const gather = useSharedValue(0);

  useEffect(() => {
    fall.value = withTiming(1, { duration: FALL_MS, easing: Easing.linear });
    grow.value = withDelay(140, withSpring(1, { damping: 9, stiffness: 150, mass: 1 }));
    pulse.value = withRepeat(withTiming(1, { duration: 520, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [fall, grow, pulse]);

  useEffect(() => {
    if (!reassembling) return;
    // Lands a moment early so the drops are already merged when the orb pops out.
    gather.value = withTiming(1, { duration: REASSEMBLE_MS - 20, easing: Easing.inOut(Easing.back(1.4)) });
  }, [reassembling, gather]);

  const puddle = useAnimatedStyle(() => {
    // The puddle drains faster than the drops fly, so they visibly take it with them.
    const size = grow.value * (1 - clamp01(gather.value * 1.5));
    return {
      transform: [
        { translateX: puddleCentre(puddleX, stageW.value) },
        { translateY: stageH.value / 2 - FLOOR_INSET },
        { scaleX: size * (1 + 0.04 * pulse.value) },
        { scaleY: size * (1 - 0.1 * pulse.value) },
      ],
    };
  });

  const midX = PUDDLE_VIEW_W / 2;
  return (
    <>
      <Animated.View style={[styles.anchor, { left: -midX, top: -PUDDLE_VIEW_H / 2 }, puddle]}>
        <Svg width={PUDDLE_VIEW_W} height={PUDDLE_VIEW_H}>
          <SlimeFill palette={palette} />
          <Ellipse cx={8} cy={23} rx={6} ry={3.5} fill={palette.deep} />
          <Ellipse cx={182} cy={22.5} rx={7} ry={4} fill={palette.deep} />
          <Ellipse cx={midX} cy={15} rx={PUDDLE_W / 2} ry={PUDDLE_H / 2} fill={`url(#${palette.id})`} />
          <Ellipse cx={midX - 16} cy={8.5} rx={30} ry={2.8} fill="#FFFFFF" opacity={palette.shine} />
          <Ellipse cx={midX + 30} cy={8} rx={6} ry={1.8} fill="#FFFFFF" opacity={palette.shine * 0.7} />
        </Svg>
      </Animated.View>
      {DROPS.map((spec, i) => (
        <Drop key={i} spec={spec} palette={palette} fall={fall} gather={gather} {...geometry} />
      ))}
    </>
  );
}

/**
 * Everything the slime leaves behind while the orb is knocked out: splats on the
 * stage edges and the burst-into-a-puddle sequence. Coordinates are offsets from
 * the stage centre, same as the ragdoll's.
 */
export function SlimeEffects({
  mood,
  splats,
  melted,
  reassembling,
  puddleX,
  hitX,
  hitY,
  stageW,
  stageH,
}: {
  mood: Mood;
  splats: Splat[];
  melted: boolean;
  reassembling: boolean;
  puddleX: number | null;
  hitX: number;
  hitY: number;
  stageW: SharedValue<number>;
  stageH: SharedValue<number>;
}) {
  const palette = PALETTES[mood];
  return (
    <View style={styles.root} pointerEvents="none">
      <View style={styles.origin}>
        {splats.map((splat) => (
          <SplatMark key={splat.id} splat={splat} palette={palette} stageH={stageH} />
        ))}
        {melted && puddleX !== null && (
          <MeltBurst
            palette={palette}
            reassembling={reassembling}
            puddleX={puddleX}
            hitX={hitX}
            hitY={hitY}
            stageW={stageW}
            stageH={stageH}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // A zero-size view at the stage centre: children are placed by their offset from it.
  origin: { width: 0, height: 0 },
  anchor: { position: 'absolute', left: 0, top: 0 },
});
