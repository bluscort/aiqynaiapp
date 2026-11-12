import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, gradients, radius, tints } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const PRESS_SPRING = { damping: 15, stiffness: 320 };

/** Spring scale for anything pressable: shrinks under the finger, bounces back on release. */
export function usePressScale(to = 0.97) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => {
      scale.value = withSpring(to, PRESS_SPRING);
    },
    onPressOut: () => {
      scale.value = withSpring(1, PRESS_SPRING);
    },
  };
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  tone = 'lime',
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'lime' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const press = usePressScale();
  return (
    <AnimatedPressable
      disabled={disabled}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        styles.button,
        tone === 'lime' && styles.lime,
        tone === 'lime' && !disabled && styles.limeGlow,
        tone === 'ghost' && styles.ghost,
        tone === 'danger' && styles.danger,
        disabled && styles.disabled,
        style,
        press.style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      {tone === 'lime' && <LinearGradient colors={gradients.primary} style={styles.buttonFill} />}
      <Text style={[styles.buttonText, { color: tone === 'lime' ? colors.limeInk : colors.text }]}>{label}</Text>
    </AnimatedPressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      hitSlop={4}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(o.value);
            }}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text numberOfLines={1} style={[styles.segmentText, active && styles.segmentTextActive]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Glass surface: soft gradient fill, hairline border and a lit top edge. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, style]}>
      <LinearGradient colors={gradients.card} style={styles.cardFill} pointerEvents="none" />
      <LinearGradient colors={gradients.edge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardEdge} pointerEvents="none" />
      {children}
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

/** Small tinted pill for rewards and statuses, e.g. "+50 XP". */
export function Badge({ label, tone = 'lime' }: { label: string; tone?: 'lime' | 'amber' }) {
  const tint = tints[tone];
  return (
    <View style={[styles.badge, { backgroundColor: tint.bg, borderColor: tint.border }]}>
      <Text style={[styles.badgeText, { color: colors[tone] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  buttonFill: { ...StyleSheet.absoluteFill, borderRadius: radius.pill },
  lime: { backgroundColor: colors.lime },
  limeGlow: {
    shadowColor: colors.lime,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  ghost: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: 'rgba(255,255,255,0.04)' },
  danger: { backgroundColor: colors.red },
  disabled: { opacity: 0.4 },
  buttonText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipActive: {
    backgroundColor: tints.lime.bg,
    borderColor: colors.lime,
    shadowColor: colors.lime,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  chipText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: colors.lime },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentItem: {
    flex: 1,
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentItemActive: {
    backgroundColor: tints.lime.bg,
    borderColor: tints.lime.border,
    shadowColor: colors.lime,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  segmentText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: colors.lime },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  cardFill: { ...StyleSheet.absoluteFill, borderRadius: radius.xl - 1 },
  cardEdge: { position: 'absolute', top: 0, left: radius.xl, right: radius.xl, height: 1 },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1 },
  badgeText: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
