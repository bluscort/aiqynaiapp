import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, type LayoutChangeEvent } from 'react-native';
import {
  Easing,
  useFrameCallback,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** Taps needed within TAP_WINDOW_MS to knock the orb out. */
const TAPS_TO_KNOCK_OUT = 5;
const TAP_WINDOW_MS = 1500;

const GRAVITY = 2600; // px/s²
const RESTITUTION = 0.62; // share of speed kept after a bounce
const WALL_FRICTION = 0.92; // horizontal speed kept when hitting the floor
const ROLL_DAMPING = 0.3; // horizontal speed kept per second while rolling on the floor
const MAX_THROW = 4500; // px/s
const REST_SPEED = 60; // below this a bounce on the floor stops
const HARD_IMPACT = 350; // px/s — squash, haptic and a slime splat above this speed
// Only a real throw counts towards melting: the knock-out fall and settling bounces stay below this.
const MELT_IMPACT = 1400; // px/s
const HITS_TO_MELT = 4;
const SQUASH_LIMIT = 0.5;

const MAX_SPLATS = 8;
const SPLAT_TTL_MS = 2800;
/** How long the puddle rests on the floor before the drops fly back. */
const PUDDLE_MS = 1600;
/** How long the drops take to fly from the puddle back to the centre. */
export const REASSEMBLE_MS = 650;

// mass: 1 keeps these springs lively; Reanimated 4 defaults to a much heavier mass of 4.
const JELLY_SPRING = { damping: 4, stiffness: 170, mass: 1 };
const POP_SPRING = { damping: 8, stiffness: 220, mass: 1 };

export type SplatSide = 'left' | 'right' | 'floor' | 'ceiling';
/** A slime mark left on a stage edge; x/y are offsets from the stage centre. */
export type Splat = { id: number; x: number; y: number; side: SplatSide; impact: number };

type Timer = ReturnType<typeof setTimeout>;

/**
 * Ragdoll physics for the orb. The orb rests at the centre of the stage; x/y are
 * offsets from that centre. Five quick taps make it fall, then it can be dragged
 * and thrown and bounces off the stage edges like a slime ball: every hard hit
 * leaves a splat, and after HITS_TO_MELT strong ones it bursts into a puddle and
 * reassembles at the centre.
 */
export function useRagdoll(radius: number) {
  const [active, setActive] = useState(false);
  const [melted, setMelted] = useState(false);
  const [reassembling, setReassembling] = useState(false);
  const [splats, setSplats] = useState<Splat[]>([]);
  const [puddleX, setPuddleX] = useState<number | null>(null);
  const [hit, setHit] = useState({ x: 0, y: 0 }); // where the melting hit landed
  const activeRef = useRef(false);
  const meltedRef = useRef(false);
  const hardHitsRef = useRef(0);
  const splatSeq = useRef(0);
  const taps = useRef<number[]>([]);
  const timers = useRef(new Set<Timer>());
  const meltTimers = useRef<Timer[]>([]);

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const vx = useSharedValue(0);
  const vy = useSharedValue(0);
  const spin = useSharedValue(0); // radians
  const squash = useSharedValue(0); // 0..SQUASH_LIMIT, wobbles around 0 after a hit
  const squashVertical = useSharedValue(1); // 1 = floor/ceiling hit, 0 = wall hit
  const orbScale = useSharedValue(1); // 0 while the orb is a puddle
  const dragging = useSharedValue(false);
  // Stops the physics at once; frame.setActive only follows after the next render.
  const frozen = useSharedValue(false);
  const stageW = useSharedValue(0);
  const stageH = useSharedValue(0);

  const onStageLayout = useCallback(
    (e: LayoutChangeEvent) => {
      stageW.value = e.nativeEvent.layout.width;
      stageH.value = e.nativeEvent.layout.height;
    },
    [stageW, stageH],
  );

  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);

  const cancelMelt = useCallback(() => {
    meltTimers.current.forEach((id) => {
      clearTimeout(id);
      timers.current.delete(id);
    });
    meltTimers.current = [];
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => clearTimeout(id));
  }, []);

  /** The orb grows back at the centre and the ragdoll round is over. */
  const regrow = useCallback(() => {
    meltTimers.current = [];
    meltedRef.current = false;
    x.value = 0;
    y.value = 0;
    vx.value = 0;
    vy.value = 0;
    spin.value = 0;
    squash.value = 0;
    orbScale.value = withSpring(1, POP_SPRING);
    setMelted(false);
    setReassembling(false);
    setPuddleX(null);
    setActive(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [x, y, vx, vy, spin, squash, orbScale]);

  /** The orb bursts: it vanishes where it hit, a puddle forms below, then the drops fly back. */
  const melt = useCallback(
    (nx: number, hitX: number, hitY: number) => {
      meltedRef.current = true;
      hardHitsRef.current = 0;
      frozen.value = true;
      dragging.value = false;
      vx.value = 0;
      vy.value = 0;
      squash.value = withTiming(0.85, { duration: 90 });
      orbScale.value = withTiming(0, { duration: 110 });
      setHit({ x: hitX, y: hitY });
      setPuddleX(nx);
      setMelted(true);

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const patter = [80, 160, 260].map((ms) =>
        later(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), ms),
      );
      meltTimers.current = [
        ...patter,
        later(() => setReassembling(true), PUDDLE_MS),
        later(regrow, PUDDLE_MS + REASSEMBLE_MS),
      ];
    },
    [frozen, dragging, vx, vy, squash, orbScale, later, regrow],
  );

  /** nx/ny is the orb's centre at the moment it hit `side` at `impact` px/s. */
  const onHardImpact = useCallback(
    (nx: number, ny: number, side: SplatSide, impact: number) => {
      if (meltedRef.current) return;
      // The splat sticks to the edge the orb touched, not to the orb's centre.
      const hitX = side === 'left' ? nx - radius : side === 'right' ? nx + radius : nx;
      const hitY = side === 'floor' ? ny + radius : side === 'ceiling' ? ny - radius : ny;
      const id = splatSeq.current++;
      setSplats((prev) => [...prev.slice(1 - MAX_SPLATS), { id, x: hitX, y: hitY, side, impact }]);
      later(() => setSplats((prev) => prev.filter((s) => s.id !== id)), SPLAT_TTL_MS);

      if (impact > MELT_IMPACT) hardHitsRef.current += 1;
      if (hardHitsRef.current >= HITS_TO_MELT) melt(nx, hitX, hitY);
      else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },
    [radius, later, melt],
  );

  const frame = useFrameCallback((info) => {
    if (dragging.value || frozen.value) return;
    const dt = Math.min(info.timeSincePreviousFrame ?? 16, 32) / 1000;
    const maxX = Math.max(0, stageW.value / 2 - radius);
    const maxY = Math.max(0, stageH.value / 2 - radius);

    let nvx = vx.value;
    let nvy = vy.value + GRAVITY * dt;
    let nx = x.value + nvx * dt;
    let ny = y.value + nvy * dt;
    let impact = 0;
    let vertical = true;
    let side: SplatSide = 'floor';

    if (nx > maxX || nx < -maxX) {
      nx = nx > 0 ? maxX : -maxX;
      if ((nx > 0 && nvx > 0) || (nx < 0 && nvx < 0)) {
        impact = Math.abs(nvx);
        vertical = false;
        side = nx > 0 ? 'right' : 'left';
        nvx = -nvx * RESTITUTION;
      }
    }
    const onFloor = ny >= maxY;
    if (onFloor) {
      ny = maxY;
      if (nvy > 0) {
        if (nvy > impact) {
          impact = nvy;
          vertical = true;
          side = 'floor';
        }
        nvy = nvy < REST_SPEED ? 0 : -nvy * RESTITUTION;
        nvx *= WALL_FRICTION;
      }
      if (nvy === 0) nvx *= Math.pow(ROLL_DAMPING, dt);
      if (Math.abs(nvx) < 4) nvx = 0;
    } else if (ny < -maxY) {
      ny = -maxY;
      if (nvy < 0) {
        if (-nvy > impact) {
          impact = -nvy;
          vertical = true;
          side = 'ceiling';
        }
        nvy = -nvy * RESTITUTION;
      }
    }

    if (impact > HARD_IMPACT) {
      squashVertical.value = vertical ? 1 : 0;
      squash.value = withSequence(
        withTiming(Math.min(SQUASH_LIMIT, impact / 5000), { duration: 60 }),
        withSpring(0, JELLY_SPRING),
      );
      scheduleOnRN(onHardImpact, nx, ny, side, impact);
    }

    // A ball rolls: rotation follows horizontal travel.
    spin.value += (nvx * dt) / radius;
    x.value = nx;
    y.value = ny;
    vx.value = nvx;
    vy.value = nvy;
  }, false);

  useEffect(() => {
    activeRef.current = active;
    frame.setActive(active && !melted);
  }, [active, melted, frame]);

  const knockOut = useCallback(() => {
    hardHitsRef.current = 0;
    frozen.value = false;
    x.value = 0;
    y.value = 0;
    vx.value = (Math.random() - 0.5) * 500;
    vy.value = -750; // a little hop before it collapses
    setActive(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, [frozen, x, y, vx, vy]);

  /** Call on every orb tap; returns true if this tap knocked the orb out. */
  const registerTap = useCallback(() => {
    if (activeRef.current) return false;
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < TAP_WINDOW_MS), now];
    if (taps.current.length >= TAPS_TO_KNOCK_OUT) {
      taps.current = [];
      knockOut();
      return true;
    }
    return false;
  }, [knockOut]);

  const reset = useCallback(() => {
    cancelMelt();
    frozen.value = true;
    meltedRef.current = false;
    hardHitsRef.current = 0;
    setActive(false);
    setMelted(false);
    setReassembling(false);
    setPuddleX(null);
    taps.current = [];
    vx.value = 0;
    vy.value = 0;
    x.value = withSpring(0, { damping: 14 });
    y.value = withSpring(0, { damping: 14 });
    // Unwind to the nearest full turn so it doesn't spin back through many rotations.
    const turn = 2 * Math.PI;
    spin.value = withTiming(Math.round(spin.value / turn) * turn, { duration: 450, easing: Easing.out(Easing.cubic) });
    squash.value = withTiming(0, { duration: 150 });
    orbScale.value = withSpring(1, POP_SPRING);
  }, [cancelMelt, frozen, x, y, vx, vy, spin, squash, orbScale]);

  const panHandlers = useMemo(() => {
    let startX = 0;
    let startY = 0;
    let startSpin = 0;
    const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));
    const limits = () => [Math.max(0, stageW.value / 2 - radius), Math.max(0, stageH.value / 2 - radius)] as const;
    // A puddle can't be grabbed.
    const grabbable = () => activeRef.current && !meltedRef.current;

    return PanResponder.create({
      // Capture before the orb's own Pressable, but only while knocked out.
      onStartShouldSetPanResponderCapture: grabbable,
      onMoveShouldSetPanResponderCapture: grabbable,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragging.value = true;
        startX = x.value;
        startY = y.value;
        startSpin = spin.value;
        vx.value = 0;
        vy.value = 0;
        void Haptics.selectionAsync();
      },
      onPanResponderMove: (_, g) => {
        if (!grabbable()) return;
        const [mx, my] = limits();
        x.value = clamp(startX + g.dx, mx);
        y.value = clamp(startY + g.dy, my);
        spin.value = startSpin + (g.dx / radius) * 0.5;
      },
      onPanResponderRelease: (_, g) => {
        if (grabbable()) {
          // PanResponder reports velocity in px/ms.
          vx.value = clamp(g.vx * 1000, MAX_THROW);
          vy.value = clamp(g.vy * 1000, MAX_THROW);
        }
        dragging.value = false;
      },
      onPanResponderTerminate: () => {
        dragging.value = false;
      },
    }).panHandlers;
  }, [radius, x, y, vx, vy, spin, dragging, stageW, stageH]);

  return {
    active,
    melted,
    reassembling,
    splats,
    puddleX,
    hitX: hit.x,
    hitY: hit.y,
    registerTap,
    reset,
    panHandlers,
    onStageLayout,
    x,
    y,
    spin,
    squash,
    squashVertical,
    orbScale,
    stageW,
    stageH,
  };
}
