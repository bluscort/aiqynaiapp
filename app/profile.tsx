import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RadarChart } from '@/components/RadarChart';
import { Card, Chip, Label, Segmented } from '@/components/ui';
import { COMBOS, SUBJECTS, SUBJECT_LABELS, SUBJECT_SHORT } from '@/data/combos';
import { TARGET_UNIVERSITY_IDS, getUniversity } from '@/data/universities';
import { useMascot } from '@/hooks/useMascot';
import { useLang, useT, type Lang } from '@/i18n';
import { initials, levelFromXp } from '@/lib/format';
import { cancelReminders, scheduleDailyReminder } from '@/lib/notifications';
import { useUserStore } from '@/store/userStore';
import { colors, radius } from '@/theme';

const REMINDER_HOURS = [8, 16, 19, 21];
const DEFAULT_NAME = 'Абитуриент';

export default function Profile() {
  const t = useT();
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const store = useUserStore();
  const { streak } = useMascot();
  const [name, setName] = useState(store.name);
  const [reminderError, setReminderError] = useState(false);

  const commitName = () => {
    const trimmed = name.trim() || DEFAULT_NAME;
    setName(trimmed);
    store.updateProfile({ name: trimmed });
  };

  const setLanguage = (next: Lang) => {
    store.setLanguage(next);
    if (store.reminders.enabled) void scheduleDailyReminder(store.reminders.hour, store.reminders.minute, next);
  };

  const toggleReminders = async (enabled: boolean) => {
    setReminderError(false);
    if (!enabled) {
      await cancelReminders();
      store.setReminders({ enabled: false });
      return;
    }
    const ok = await scheduleDailyReminder(store.reminders.hour, store.reminders.minute, lang);
    if (!ok) return setReminderError(true);
    store.setReminders({ enabled: true });
  };

  const setReminderHour = async (hour: number) => {
    store.setReminders({ hour, minute: 0 });
    if (store.reminders.enabled) await scheduleDailyReminder(hour, 0, lang);
  };

  const hasStats = SUBJECTS.some((s) => (store.subjectXp[s] ?? 0) > 0);
  const battles = store.arena.wins + store.arena.losses + store.arena.draws;

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('profileTitle')}</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close} accessibilityRole="button" accessibilityLabel={t('close')}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(name)}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>
              {store.name}
            </Text>
            <Text style={styles.sub}>
              Lvl {levelFromXp(store.xp)} · {getUniversity(store.targetUniId).short[lang]} · {t('gradeN', { n: store.grade })}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          {[
            { label: t('totalXp'), value: store.xp },
            { label: t('streakLabel'), value: `🔥 ${streak}` },
            { label: t('coinsLabel'), value: `🪙 ${store.coins}` },
            { label: t('battles'), value: battles },
          ].map((s) => (
            <View key={s.label} style={styles.statBox}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        <Card style={styles.section}>
          <Label>{t('language')}</Label>
          <Segmented
            value={lang}
            onChange={setLanguage}
            options={[
              { value: 'ru', label: 'Русский' },
              { value: 'kk', label: 'Қазақша' },
            ]}
          />
        </Card>

        <Card style={styles.section}>
          <Label>{t('displayName')}</Label>
          <TextInput
            value={name}
            onChangeText={setName}
            onEndEditing={commitName}
            onBlur={commitName}
            maxLength={32}
            style={styles.input}
            placeholderTextColor={colors.faint}
            selectionColor={colors.lime}
            returnKeyType="done"
          />

          <View style={styles.divider} />
          <Label>{t('targetUni')}</Label>
          <View style={styles.chips}>
            {TARGET_UNIVERSITY_IDS.map((id) => (
              <Chip
                key={id}
                label={getUniversity(id).short[lang]}
                active={store.targetUniId === id}
                onPress={() => store.updateProfile({ targetUniId: id })}
              />
            ))}
          </View>

          <View style={styles.divider} />
          <Label>{t('profileSubjects')}</Label>
          <View style={styles.chips}>
            {COMBOS.map((c) => (
              <Chip key={c.id} label={c.short[lang]} active={store.combo === c.id} onPress={() => store.updateProfile({ combo: c.id })} />
            ))}
          </View>

          <View style={styles.divider} />
          <Label>{t('grade')}</Label>
          <Segmented
            value={store.grade}
            onChange={(grade) => store.updateProfile({ grade })}
            options={[
              { value: 10 as const, label: t('gradeN', { n: 10 }) },
              { value: 11 as const, label: t('gradeN', { n: 11 }) },
            ]}
          />
        </Card>

        <Card style={styles.section}>
          <Label>{t('stats')}</Label>
          {hasStats ? (
            <View style={styles.radar}>
              <RadarChart axes={SUBJECTS.map((s) => ({ label: SUBJECT_SHORT[s][lang], value: store.subjectXp[s] ?? 0 }))} />
              <View style={styles.legend}>
                {SUBJECTS.filter((s) => (store.subjectXp[s] ?? 0) > 0).map((s) => (
                  <Text key={s} style={styles.legendItem}>
                    {SUBJECT_LABELS[s][lang]} · {store.subjectXp[s]} XP
                  </Text>
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.muted}>{t('statsEmpty')}</Text>
          )}
        </Card>

        <Card style={styles.section}>
          <Label>{t('reminders')}</Label>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t('remindersToggle')}</Text>
            <Switch
              value={store.reminders.enabled}
              onValueChange={(v) => void toggleReminders(v)}
              trackColor={{ true: colors.lime, false: '#2A2F3A' }}
              thumbColor="#fff"
            />
          </View>
          {reminderError && <Text style={styles.error}>{t('remindersDenied')}</Text>}
          <Text style={[styles.muted, styles.timeLabel]}>{t('reminderTime')}</Text>
          <View style={styles.chips}>
            {REMINDER_HOURS.map((h) => (
              <Chip
                key={h}
                label={`${String(h).padStart(2, '0')}:00`}
                active={store.reminders.hour === h}
                onPress={() => void setReminderHour(h)}
              />
            ))}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.limeInk, fontSize: 20, fontWeight: '900' },
  name: { color: colors.text, fontSize: 20, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.faint, fontSize: 11, marginTop: 3 },
  section: { marginTop: 14 },
  input: {
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  radar: { alignItems: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 4 },
  legendItem: { color: colors.muted, fontSize: 12 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { color: colors.text, fontSize: 15 },
  error: { color: colors.red, fontSize: 12, marginTop: 6 },
  timeLabel: { marginTop: 12, marginBottom: 8, fontSize: 13 },
});
