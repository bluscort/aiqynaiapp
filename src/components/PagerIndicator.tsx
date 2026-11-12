import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { colors, tints } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_WIDTH = 92;
const TAB_HEIGHT = 50;
const DOCK_PADDING = 5;
/** Outline icon while idle, filled one while active — one pair per page. */
const ICONS: [IconName, IconName][] = [
  ['sparkles-outline', 'sparkles'],
  ['compass-outline', 'compass'],
  ['trophy-outline', 'trophy'],
];

function Tab({
  index,
  progress,
  label,
  selected,
  onPress,
}: {
  index: number;
  progress: SharedValue<number>;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const [idle, active] = ICONS[index % ICONS.length]!;

  const iconWrap = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(progress.value - index));
    return { transform: [{ scale: interpolate(d, [0, 1], [1.12, 1]) }] };
  });
  const idleIcon = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.abs(progress.value - index)) }));
  const activeIcon = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, Math.abs(progress.value - index)) }));
  const text = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(progress.value - index));
    return { color: interpolateColor(d, [0, 1], [colors.lime, colors.muted]), opacity: interpolate(d, [0, 1], [1, 0.8]) };
  });

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <Animated.View style={iconWrap}>
        <Animated.View style={idleIcon}>
          <Ionicons name={idle} size={20} color={colors.muted} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, activeIcon]}>
          <Ionicons name={active} size={20} color={colors.lime} />
        </Animated.View>
      </Animated.View>
      <Animated.Text numberOfLines={1} style={[styles.label, text]}>
        {label}
      </Animated.Text>
    </Pressable>
  );
}

/** Floating glass dock: one labelled tab per page; the highlight follows the finger while swiping. */
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
  const [current, setCurrent] = useState(0);
  const last = labels.length - 1;

  useAnimatedReaction(
    () => Math.round(progress.value),
    (page, prev) => {
      if (page !== prev) scheduleOnRN(setCurrent, page);
    },
  );

  const highlight = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.max(0, Math.min(last, progress.value)) * TAB_WIDTH }],
  }));

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.shadow}>
        <View style={styles.dock} accessibilityRole="tablist">
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <Animated.View style={[styles.highlight, highlight]} />
          {labels.map((label, i) => (
            <Tab key={label} index={i} progress={progress} label={label} selected={current === i} onPress={() => onSelect(i)} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 6 },
  shadow: {
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  dock: {
    flexDirection: 'row',
    padding: DOCK_PADDING,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(21,27,40,0.72)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  highlight: {
    position: 'absolute',
    top: DOCK_PADDING,
    left: DOCK_PADDING,
    width: TAB_WIDTH,
    height: TAB_HEIGHT,
    borderRadius: 999,
    backgroundColor: tints.lime.bg,
    borderWidth: 1,
    borderColor: 'rgba(212,245,60,0.28)',
  },
  tab: { width: TAB_WIDTH, height: TAB_HEIGHT, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
});
