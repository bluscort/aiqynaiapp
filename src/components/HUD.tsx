import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCombo } from '@/data/combos';
import { getUniversity } from '@/data/universities';
import { useMascot } from '@/hooks/useMascot';
import { useLang } from '@/i18n';
import { XP_PER_LEVEL, initials, levelFromXp } from '@/lib/format';
import { useUserStore } from '@/store/userStore';
import { colors, gradients, radius, tints } from '@/theme';

/** Pill that pops when its value changes, so rewards from the Arena or quizzes are visible in the HUD. */
function Stat({ value, style, children }: { value: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const scale = useSharedValue(1);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      scale.value = withSequence(withTiming(1.18, { duration: 140 }), withSpring(1, { damping: 7 }));
      prev.current = value;
    }
  }, [value, scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.pill, style, pop]}>{children}</Animated.View>;
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
  const levelProgress = (xp % XP_PER_LEVEL) / XP_PER_LEVEL;

  return (
    <View style={[styles.row, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={openProfile} hitSlop={6} style={styles.uniChip} accessibilityRole="button">
        <Ionicons name="school-outline" size={15} color={colors.cyan} />
        <Text numberOfLines={1} style={styles.uniText}>
          {uni.short[lang]}
        </Text>
        <Text style={styles.dot}>•</Text>
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
        <Stat value={xp} style={styles.level}>
          <Text style={[styles.statText, styles.levelText]}>Lvl {levelFromXp(xp)}</Text>
          {/* XP towards the next level. */}
          <View style={styles.levelTrack}>
            <View style={[styles.levelFill, { width: `${Math.round(levelProgress * 100)}%` as const }]} />
          </View>
        </Stat>
      </View>

      <Pressable onPress={openProfile} hitSlop={6} accessibilityRole="button" accessibilityLabel="Profile">
        <LinearGradient colors={gradients.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(name)}</Text>
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const PILL_HEIGHT = 32;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 5,
  },
  uniChip: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    height: PILL_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  uniText: { color: colors.text, fontWeight: '800', fontSize: 13 },
  dot: { color: colors.faint, fontSize: 12 },
  comboText: { color: colors.muted, fontWeight: '600', fontSize: 12, flexShrink: 1 },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 5 },
  pill: {
    height: PILL_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statText: { color: colors.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  level: { backgroundColor: tints.lime.bg, borderColor: 'rgba(212,245,60,0.35)', overflow: 'hidden' },
  levelText: { color: colors.lime, fontWeight: '800' },
  levelTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: 'rgba(212,245,60,0.15)' },
  levelFill: { height: '100%', backgroundColor: colors.lime },
  avatarRing: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontWeight: '800', fontSize: 12 },
});
