import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card, Chip, Label, PrimaryButton } from '@/components/ui';
import { COMBOS } from '@/data/combos';
import { useLang, useT, type StringKey } from '@/i18n';
import { buildPlan, formatPlan, pct, type MatchPlan, type ScoredProgram, type Tier } from '@/lib/matcher';
import { useUserStore } from '@/store/userStore';
import { colors, radius, tierColors } from '@/theme';

const MAX_SCORE = 140;
const TIERS: { tier: Tier; label: StringKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { tier: 'reach', label: 'tierReach', icon: 'star-outline' },
  { tier: 'target', label: 'tierTarget', icon: 'checkmark-circle-outline' },
  { tier: 'safety', label: 'tierSafety', icon: 'shield-checkmark-outline' },
];

function ProgramRow({ item }: { item: ScoredProgram }) {
  const lang = useLang();
  const t = useT();
  return (
    <View style={styles.programRow}>
      <View style={styles.flex}>
        <Text style={styles.programUni} numberOfLines={1}>
          {item.university.short[lang]} · {item.program.gop}
        </Text>
        <Text style={styles.programName} numberOfLines={1}>
          {item.program.name[lang]}
        </Text>
        <Text style={styles.programMeta}>
          ~{item.effectiveCutoff} · {t('grants', { n: item.program.grants })}
        </Text>
        {item.program.note && <Text style={styles.note}>{item.program.note[lang]}</Text>}
      </View>
      <Text style={[styles.prob, { color: tierColors[item.tier] }]}>{pct(item.probability)}</Text>
    </View>
  );
}

export function MatcherScreen() {
  const t = useT();
  const lang = useLang();
  const input = useUserStore((s) => s.matcher);
  const setMatcher = useUserStore((s) => s.setMatcher);
  const targetUniId = useUserStore((s) => s.targetUniId);
  const [plan, setPlan] = useState<MatchPlan | null>(null);
  const [copied, setCopied] = useState(false);

  // Inputs changed after calculating: results are stale, hide them until recalculated.
  useEffect(() => setPlan(null), [input.score, input.combo, input.rural, input.social]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);

  const calculate = () => {
    setPlan(buildPlan(input, targetUniId));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const copy = async () => {
    if (!plan) return;
    await Clipboard.setStringAsync(formatPlan(plan, input, lang));
    setCopied(true);
  };

  const share = () => {
    if (plan) void Share.share({ message: formatPlan(plan, input, lang) });
  };

  const setScore = (score: number) => setMatcher({ score: Math.max(0, Math.min(MAX_SCORE, Math.round(score))) });

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{t('matcherTitle')}</Text>
      <Text style={styles.subtitle}>{t('matcherSub')}</Text>

      <Card style={styles.gap}>
        <Label>{t('untScore')}</Label>
        <View style={styles.scoreRow}>
          <Pressable onPress={() => setScore(input.score - 1)} style={styles.stepBtn} hitSlop={6}>
            <Ionicons name="remove" size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.score}>
            {input.score}
            <Text style={styles.scoreMax}> / {MAX_SCORE}</Text>
          </Text>
          <Pressable onPress={() => setScore(input.score + 1)} style={styles.stepBtn} hitSlop={6}>
            <Ionicons name="add" size={20} color={colors.text} />
          </Pressable>
        </View>
        <Slider
          minimumValue={0}
          maximumValue={MAX_SCORE}
          step={1}
          value={input.score}
          onValueChange={setScore}
          minimumTrackTintColor={colors.lime}
          maximumTrackTintColor="rgba(255,255,255,0.15)"
          thumbTintColor={colors.lime}
        />

        <View style={styles.divider} />
        <Label>{t('profileSubjects')}</Label>
        <View style={styles.chips}>
          {COMBOS.map((c) => (
            <Chip key={c.id} label={c.short[lang]} active={input.combo === c.id} onPress={() => setMatcher({ combo: c.id })} />
          ))}
        </View>

        <View style={styles.divider} />
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{t('ruralQuota')}</Text>
          <Switch value={input.rural} onValueChange={(rural) => setMatcher({ rural })} trackColor={{ true: colors.lime, false: '#2A2F3A' }} thumbColor="#fff" />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{t('socialQuota')}</Text>
          <Switch value={input.social} onValueChange={(social) => setMatcher({ social })} trackColor={{ true: colors.lime, false: '#2A2F3A' }} thumbColor="#fff" />
        </View>
      </Card>

      <PrimaryButton label={t('calculate')} onPress={calculate} style={styles.gap} />

      {plan && (
        <Animated.View entering={FadeInDown.duration(320)} style={styles.results}>
          {plan.belowThreshold && (
            <View style={styles.warning}>
              <Text style={styles.warningText}>{t('belowThreshold', { min: plan.minThreshold })}</Text>
            </View>
          )}

          {!plan.belowThreshold &&
            TIERS.map(({ tier, label, icon }) => {
              const items = plan[tier];
              return (
                <Card key={tier} style={[styles.tierCard, { borderColor: `${tierColors[tier]}55` }]}>
                  <View style={styles.tierHeader}>
                    <Ionicons name={icon} size={18} color={tierColors[tier]} />
                    <Text style={[styles.tierTitle, { color: tierColors[tier] }]}>{t(label)}</Text>
                  </View>
                  {items.length === 0 ? (
                    <Text style={styles.empty}>{t('tierEmpty')}</Text>
                  ) : (
                    items.map((item) => <ProgramRow key={item.program.id} item={item} />)
                  )}
                </Card>
              );
            })}

          {plan.choices.length > 0 && (
            <Card style={styles.finalCard}>
              <Label>{t('finalPlan')}</Label>
              {plan.choices.map((c, i) => (
                <View key={c.program.id} style={styles.choiceRow}>
                  <Text style={styles.choiceIndex}>{i + 1}</Text>
                  <View style={[styles.tierBadge, { backgroundColor: `${tierColors[c.tier]}26` }]}>
                    <Text style={[styles.tierBadgeText, { color: tierColors[c.tier] }]}>{c.tier.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.choiceText} numberOfLines={2}>
                    {c.university.short[lang]} — {c.program.gop} {c.program.name[lang]}
                  </Text>
                  <Text style={styles.choiceProb}>{pct(c.probability)}</Text>
                </View>
              ))}
              {!plan.hasSafety && <Text style={styles.warnInline}>{t('noSafety')}</Text>}
              <View style={styles.exportRow}>
                <PrimaryButton label={copied ? t('copied') : t('copy')} onPress={() => void copy()} tone="ghost" style={styles.flex} />
                <PrimaryButton label={t('share')} onPress={share} tone="ghost" style={styles.flex} />
              </View>
            </Card>
          )}

          <Text style={styles.disclaimer}>{t('disclaimer')}</Text>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 4 },
  gap: { marginTop: 16 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: { color: colors.text, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scoreMax: { color: colors.faint, fontSize: 18, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  toggleLabel: { color: colors.text, fontSize: 15, flex: 1, paddingRight: 12 },
  results: { marginTop: 20, gap: 12 },
  warning: {
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  warningText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  tierCard: { gap: 10 },
  tierHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierTitle: { fontSize: 14, fontWeight: '800' },
  empty: { color: colors.faint, fontSize: 13 },
  programRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  programUni: { color: colors.text, fontSize: 15, fontWeight: '700' },
  programName: { color: colors.muted, fontSize: 13, marginTop: 1 },
  programMeta: { color: colors.faint, fontSize: 12, marginTop: 2 },
  note: { color: colors.amber, fontSize: 11, marginTop: 3 },
  prob: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  finalCard: { gap: 10, borderColor: colors.borderStrong },
  choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  choiceIndex: { color: colors.faint, fontSize: 14, fontWeight: '800', width: 14 },
  tierBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, minWidth: 62, alignItems: 'center' },
  tierBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  choiceText: { color: colors.text, fontSize: 13, flex: 1 },
  choiceProb: { color: colors.muted, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  warnInline: { color: colors.amber, fontSize: 12, lineHeight: 17 },
  exportRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  disclaimer: { color: colors.faint, fontSize: 11, lineHeight: 16, textAlign: 'center', paddingHorizontal: 8 },
});
