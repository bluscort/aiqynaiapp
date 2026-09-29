import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';

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
  const bg = tone === 'lime' ? colors.lime : tone === 'danger' ? colors.red : 'transparent';
  const fg = tone === 'lime' ? colors.limeInk : colors.text;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        tone === 'ghost' && styles.ghost,
        style,
      ]}
      accessibilityRole="button"
    >
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
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

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  ghost: { borderWidth: 1, borderColor: colors.borderStrong },
  buttonText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: colors.bg },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentItem: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center', paddingHorizontal: 6 },
  segmentItemActive: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderStrong },
  segmentText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
});
