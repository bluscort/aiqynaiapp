import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Orb } from '@/components/Orb';
import { PrimaryButton } from '@/components/ui';
import { useMascot } from '@/hooks/useMascot';
import { useLang, useT } from '@/i18n';
import { buildDailyQuiz } from '@/lib/quiz';
import { REVIVE_MIN_CORRECT, useUserStore, type DailyAnswer, type DailyResult } from '@/store/userStore';
import { answerTiles, colors, radius } from '@/theme';

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
        <Animated.View entering={FadeInDown.delay(150)} style={styles.resultBlock}>
          <Text style={styles.resultTitle}>{t('resultTitle', { c: result.correct, n: result.total })}</Text>
          <Text style={styles.resultText}>{message}</Text>
          <Text style={styles.rewards}>{t('rewards', { xp: result.xp, coins: result.coins })}</Text>
          <Text style={styles.satiety}>{t('satiety', { n: mascot.satiety })}</Text>
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

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={close} hitSlop={12} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t('close')}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{hardcore ? t('reviveTitle') : t('dailyTitle')}</Text>
        <View style={styles.closeBtn} />
      </View>

      <View style={styles.progressRow}>
        {questions.map((_, i) => {
          const a = answers[i];
          const color = a ? (a.correct ? colors.green : colors.red) : i === index ? colors.text : 'rgba(255,255,255,0.12)';
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
              const tile = answerTiles[i % answerTiles.length]!;
              const showCorrect = answered && i === q.answer;
              const showWrong = answered && i === selected && !isCorrect;
              return (
                <Pressable
                  key={i}
                  onPress={() => choose(i)}
                  disabled={answered}
                  style={({ pressed }) => [
                    styles.option,
                    pressed && { backgroundColor: colors.surface2 },
                    showCorrect && styles.optionCorrect,
                    showWrong && styles.optionWrong,
                    answered && !showCorrect && !showWrong && { opacity: 0.45 },
                  ]}
                >
                  <View style={[styles.shape, { backgroundColor: tile.color }]}>
                    <Text style={styles.shapeText}>{tile.shape}</Text>
                  </View>
                  <Text style={styles.optionText}>{option}</Text>
                  {showCorrect && <Ionicons name="checkmark-circle" size={22} color={colors.green} />}
                  {showWrong && <Ionicons name="close-circle" size={22} color={colors.red} />}
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {answered && (
          <Animated.View entering={FadeInDown.duration(250)} style={styles.feedback}>
            <Text style={[styles.feedbackTitle, { color: isCorrect ? colors.green : colors.red }]}>
              {isCorrect ? t('correct') : t('wrong', { a: text.options[q.answer]! })}
            </Text>
            {text.explain && (
              <Text style={styles.explain}>
                <Text style={styles.explainLabel}>{t('explanation')}: </Text>
                {text.explain}
              </Text>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginTop: 10 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2 },
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
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionCorrect: { borderColor: colors.green, backgroundColor: 'rgba(34,197,94,0.1)' },
  optionWrong: { borderColor: colors.red, backgroundColor: 'rgba(239,68,68,0.1)' },
  shape: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  shapeText: { color: '#fff', fontSize: 13 },
  optionText: { color: colors.text, fontSize: 16, flex: 1, fontWeight: '500' },
  feedback: {
    marginTop: 16,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  feedbackTitle: { fontSize: 15, fontWeight: '700' },
  explain: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  explainLabel: { color: colors.text, fontWeight: '700' },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
  resultBlock: { alignItems: 'center', gap: 8, marginTop: 20 },
  resultTitle: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  resultText: { color: colors.muted, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  rewards: { color: colors.lime, fontSize: 18, fontWeight: '800', marginTop: 4 },
  satiety: { color: colors.faint, fontSize: 12 },
  resultActions: { alignSelf: 'stretch', gap: 10, marginTop: 28 },
});
