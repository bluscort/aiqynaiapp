import { router } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCombo } from '@/data/combos';
import { getUniversity } from '@/data/universities';
import { useMascot } from '@/hooks/useMascot';
import { useLang } from '@/i18n';
import { initials, levelFromXp } from '@/lib/format';
import { useUserStore } from '@/store/userStore';
import { colors, radius } from '@/theme';

/** Pops when the value changes, so rewards from the Arena or quizzes are visible in the HUD. */
function Stat({ value, children }: { value: number; children: ReactNode }) {
  const scale = useSharedValue(1);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      scale.value = withSequence(withTiming(1.25, { duration: 140 }), withSpring(1, { damping: 7 }));
      prev.current = value;
    }
  }, [value, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.stat, style]}>{children}</Animated.View>;
}

export function HUD() {
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const name = useUserStore((s) => s.name);
  const xp = useUserStore((s) => s.xp);
  const coins = useUserStore((s) => s.coins);
  const uni = getUniversity(useUserStore((s) => s.targetUniId));
  const combo = getCombo(useUserStore((s) => s.combo));
  const { streak } = useMascot();
  const openProfile = () => router.push('/profile');

  return (
    <View style={[styles.row, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={openProfile} style={styles.uniChip} accessibilityRole="button">
        <Text numberOfLines={1} style={styles.uniText}>
          {uni.short[lang]}
        </Text>
        <Text numberOfLines={1} style={styles.comboText}>
          {combo.short[lang]}
        </Text>
      </Pressable>

      <View style={styles.stats}>
        <Stat value={streak}>
          <Text style={styles.statText}>🔥 {streak}</Text>
        </Stat>
        <Stat value={coins}>
          <Text style={styles.statText}>🪙 {coins}</Text>
        </Stat>
        <Stat value={xp}>
          <Text numberOfLines={1} style={styles.statText}>
            Lvl {levelFromXp(xp)} • {xp} XP
          </Text>
        </Stat>
      </View>

      <Pressable onPress={openProfile} style={styles.avatar} accessibilityRole="button" accessibilityLabel="Profile">
        <Text style={styles.avatarText}>{initials(name)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 8,
  },
  uniChip: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  uniText: { color: colors.text, fontWeight: '800', fontSize: 13 },
  comboText: { color: colors.muted, fontWeight: '600', fontSize: 12 },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 },
  stat: {},
  statText: { color: colors.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontWeight: '800', fontSize: 12 },
});
