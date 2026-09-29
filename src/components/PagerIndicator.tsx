import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';

function Dot({ index, progress, label, onPress }: { index: number; progress: SharedValue<number>; label: string; onPress: () => void }) {
  const style = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(progress.value - index));
    return {
      width: interpolate(d, [0, 1], [22, 6]),
      opacity: interpolate(d, [0, 1], [0.95, 0.35]),
    };
  });
  return (
    <Pressable hitSlop={12} onPress={onPress} accessibilityRole="tab" accessibilityLabel={label}>
      <Animated.View style={[styles.dot, style]} />
    </Pressable>
  );
}

/** Subtle translucent page indicator; follows the finger while swiping. */
export function PagerIndicator({
  progress,
  labels,
  onSelect,
}: {
  progress: SharedValue<number>;
  labels: string[];
  onSelect: (index: number) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.pill}>
        {labels.map((label, i) => (
          <Dot key={label} index={i} progress={progress} label={label} onPress={() => onSelect(i)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: { height: 6, borderRadius: 3, backgroundColor: colors.text },
});
