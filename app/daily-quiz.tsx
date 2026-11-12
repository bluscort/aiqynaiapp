import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  ZoomIn,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Orb } from '@/components/Orb';
import { Badge, Card, PrimaryButton, usePressScale } from '@/components/ui';
import { useMascot } from '@/hooks/useMascot';
import { useLang, useT } from '@/i18n';
import { buildDailyQuiz } from '@/lib/quiz';
import { REVIVE_MIN_CORRECT, useUserStore, type DailyAnswer, type DailyResult } from '@/store/userStore';
import { answerTiles, colors, radius, tints } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type OptionState = 'idle' | 'correct' | 'wrong' | 'dim';

/** Answer card: lettered badge, springy press, and an animated reveal once the question is answered. */
function OptionCard({
  index,
  label,
  state,
  onPress,
}: {
  index: number;
  label: string;
  state: OptionState;
  onPress: () => void;
}) {
  const tile = answerTiles[index % answerTiles.length]!;
  const press = usePressScale(0.98);
  const reveal = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    reveal.value = withTiming(state === 'idle' ? 0 : 1, { duration: 260 });
    if (state === 'correct' || state === 'wrong') {
      pulse.value = withSequence(withTiming(1.03, { duration: 120 }), withSpring(1, { damping: 9, stiffness: 220 }));
    }
  }, [state, reveal, pulse]);

  const tint = state === 'correct' ? tints.green : state === 'wrong' ? tints.red : null;
  const borderTo = tint ? tint.border : colors.border;
  const bgTo = tint ? tint.bg : colors.surface;
  const opacityTo = state === 'dim' ? 0.45 : 1;

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(reveal.value, [0, 1], [1, opacityTo]),
    transform: [{ scale: pulse.value }],
  }));
  const revealStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(reveal.value, [0, 1], [colors.border, borderTo]),
    backgroundColor: interpolateColor(reveal.value, [0, 1], [colors.surface, bgTo]),
  }));

  return (
    <Animated.View style={pulseStyle}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        disabled={state !== 'idle'}
        style={[styles.option, revealStyle, press.style]}
        accessibilityRole="button"
        accessibilityLabel={`${tile.shape}. ${label}`}
        accessibilityState={{ disabled: state !== 'idle', selected: state === 'correct' || state === 'wrong' }}
      >
        <View style={[styles.letter, { backgroundColor: tile.bg, borderColor: tile.border }]}>
          <Text style={[styles.letterText, { color: tile.color }]}>{tile.shape}</Text>
        </View>
        <Text style={styles.optionText}>{label}</Text>
        {state === 'correct' && <Ionicons name="checkmark-circle" size={22} color={colors.green} />}
        {state === 'wrong' && <Ionicons name="close-circle" size={22} color={colors.red} />}
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function DailyQuiz() {
  const t = useT();
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const combo = useUserStore((s) => s.combo);
  const completeDailyQuiz = useUserStore((s) => s.completeDailyQuiz);
  const mascot = useMascot();

  // Decided once on open: a burned streak turns the feeding into a hardcore revival test.
  const [hardcore, setHardcore] = useState(() => mascot.ghost);
  const [questions, setQuestions] = useState(() => buildDailyQuiz(combo, mascot.ghost));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<DailyAnswer[]>([]);
  const [result, setResult] = useState<DailyResult | null>(null);

  const q = questions[index]!;
  const text = q[lang];
  const correctSoFar = answers.filter((a) => a.correct).length;

  const choose = (i: number) => {
    if (selected !== null) return;
    const correct = i === q.answer;
    setSelected(i);
    setAnswers((prev) => [...prev, { subject: q.subject, correct }]);
    void Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
  };

  const next = () => {
    if (index < questions.length - 1) {
      setIndex(index + 1);
      setSelected(null);
      return;
    }
    setResult(completeDailyQuiz(answers, hardcore));
  };

  const restart = () => {
    const stillGhost = hardcore && !result?.revived;
    setHardcore(stillGhost);
    setQuestions(buildDailyQuiz(combo, stillGhost));
    setIndex(0);
    setSelected(null);
    setAnswers([]);
    setResult(null);
  };

  const close = () => router.back();

  if (result) {
    let message: string;
    if (result.revived) message = t('resultRevived');
    else if (result.reviveFailed) message = t('resultReviveFailed', { n: REVIVE_MIN_CORRECT });
    else if (result.fed) message = t('resultFed', { streak: result.streak });
    else message = t('resultNotFed');

    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Animated.View entering={ZoomIn.duration(400)}>
          <Orb mood={mascot.mood} size={170} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(150)} style={styles.resultWrap}>
          <Card style={styles.resultCard}>
            <Text style={styles.resultTitle}>{t('resultTitle', { c: result.correct, n: result.total })}</Text>
            <Text style={styles.resultText}>{message}</Text>
            <View style={styles.rewardRow}>
              <Badge label={`+${result.xp} XP`} />
              {result.coins > 0 && <Badge label={`+${result.coins} 🪙`} tone="amber" />}
            </View>
            <View style={styles.satietyRow}>
              <Ionicons name="flash" size={13} color={colors.muted} />
              <Text style={styles.satiety}>{t('satiety', { n: mascot.satiety })}</Text>
            </View>
          </Card>
        </Animated.View>
        <View style={styles.resultActions}>
          <PrimaryButton label={t('done')} onPress={close} />
          <PrimaryButton label={t('tryAgain')} onPress={restart} tone="ghost" />
        </View>
      </View>
    );
  }

  const answered = selected !== null;
  const isCorrect = selected === q.answer;
  const feedbackColor = isCorrect ? colors.green : colors.red;
  const feedbackTint = isCorrect ? tints.green : tints.red;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={close} hitSlop={12} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t('close')}>
          <Ionicons name="close" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{hardcore ? t('reviveTitle') : t('dailyTitle')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.progressRow}>
        {questions.map((_, i) => {
          const a = answers[i];
          const color = a ? (a.correct ? colors.green : colors.red) : i === index ? colors.lime : 'rgba(255,255,255,0.12)';
          return <View key={i} style={[styles.progressSeg, { backgroundColor: color }]} />;
        })}
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.orbRow}>
          <Orb mood={hardcore ? 'critical' : correctSoFar >= 3 ? 'happy' : mascot.mood} size={72} />
          <View style={styles.flex}>
            <Text style={styles.counter}>{t('questionOf', { i: index + 1, n: questions.length })}</Text>
            {hardcore && <Text style={styles.rule}>{t('reviveRule', { n: REVIVE_MIN_CORRECT })}</Text>}
          </View>
        </View>

        <Animated.View key={q.id} entering={FadeIn.duration(250)}>
          <Text style={styles.question}>{text.q}</Text>
          <View style={styles.options}>
            {text.options.map((option, i) => {
              let state: OptionState = 'idle';
              if (answered) state = i === q.answer ? 'correct' : i === selected ? 'wrong' : 'dim';
              return <OptionCard key={i} index={i} label={option} state={state} onPress={() => choose(i)} />;
            })}
          </View>
        </Animated.View>

        {answered && (
          <Animated.View
            entering={FadeInDown.duration(250)}
            style={[styles.feedback, { borderColor: feedbackTint.border, backgroundColor: feedbackTint.bg }]}
          >
            <View style={styles.feedbackHead}>
              <View style={[styles.feedbackIcon, { backgroundColor: feedbackColor }]}>
                <Ionicons name={isCorrect ? 'checkmark' : 'close'} size={16} color={colors.bg} />
              </View>
              <Text style={[styles.feedbackTitle, { color: feedbackColor }]}>
                {isCorrect ? t('correct') : t('wrong', { a: text.options[q.answer]! })}
              </Text>
            </View>
            {text.explain && (
              <View style={styles.explainBlock}>
                <View style={styles.explainHead}>
                  <Ionicons name="bulb-outline" size={14} color={colors.muted} />
                  <Text style={styles.explainLabel}>{t('explanation')}</Text>
                </View>
                <Text style={styles.explain}>{text.explain}</Text>
              </View>
            )}
          </Animated.View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <PrimaryButton label={index < questions.length - 1 ? t('next') : t('finish')} onPress={next} disabled={!answered} />
      </View>
    </View>
  );
}

const CLOSE_SIZE = 36;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  closeBtn: {
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    borderRadius: CLOSE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerSpacer: { width: CLOSE_SIZE },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginTop: 12 },
  progressSeg: { flex: 1, height: 6, borderRadius: 3 },
  body: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 24 },
  orbRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  counter: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  rule: { color: colors.red, fontSize: 12, marginTop: 3, lineHeight: 17 },
  question: { color: colors.text, fontSize: 20, lineHeight: 28, fontWeight: '700' },
  options: { gap: 10, marginTop: 18 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  letter: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontSize: 14, fontWeight: '900' },
  optionText: { color: colors.text, fontSize: 16, flex: 1, fontWeight: '500' },
  feedback: { marginTop: 16, padding: 14, borderRadius: radius.md, borderWidth: 1, gap: 12 },
  feedbackHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedbackIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  feedbackTitle: { flex: 1, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  explainBlock: { gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  explainHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  explainLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  explain: { color: colors.text, fontSize: 14, lineHeight: 20 },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
  resultWrap: { alignSelf: 'stretch', marginTop: 20 },
  resultCard: { alignItems: 'center', gap: 10, padding: 20 },
  resultTitle: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  resultText: { color: colors.muted, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  rewardRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  satietyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  satiety: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  resultActions: { alignSelf: 'stretch', gap: 10, marginTop: 20 },
});
