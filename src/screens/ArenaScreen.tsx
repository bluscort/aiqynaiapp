import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Orb } from '@/components/Orb';
import { Card, PrimaryButton, Segmented } from '@/components/ui';
import type { Subject } from '@/data/combos';
import { LEAGUE_SCHOOLS, LEAGUE_STUDENTS } from '@/data/leaderboard';
import type { Question } from '@/data/questions';
import { useLang, useT, type StringKey } from '@/i18n';
import { initials } from '@/lib/format';
import { buildBattleQuiz } from '@/lib/quiz';
import { useUserStore, type DuelOutcome } from '@/store/userStore';
import { answerTiles, colors, radius } from '@/theme';

const TOTAL_MS = 60_000;
const REVEAL_MS = 1100;
const BOT_ACCURACY = 0.68;

/** Kahoot-style scoring: 100 for a correct answer + up to 100 speed bonus. */
const points = (seconds: number) => 100 + Math.max(0, Math.round(100 - seconds * 12));

interface BotTurn {
  correct: boolean;
  choice: number;
  time: number;
  answered: boolean;
}

type Phase = 'lobby' | 'playing' | 'result';

// ── Battle ──────────────────────────────────────────────────────────────

function Battle({ onPlayingChange }: { onPlayingChange: (playing: boolean) => void }) {
  const t = useT();
  const lang = useLang();
  const combo = useUserStore((s) => s.combo);
  const arena = useUserStore((s) => s.arena);
  const recordDuel = useUserStore((s) => s.recordDuel);

  const [phase, setPhase] = useState<Phase>('lobby');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [scores, setScores] = useState({ user: 0, bot: 0 });
  const [bot, setBot] = useState<BotTurn | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [outcome, setOutcome] = useState<DuelOutcome | null>(null);

  const questionsRef = useRef<Question[]>([]);
  const startRef = useRef(0);
  const questionStartRef = useRef(0);
  const scoresRef = useRef({ user: 0, bot: 0 });
  const botRef = useRef<BotTurn | null>(null);
  const correctSubjects = useRef<Subject[]>([]);
  const finishedRef = useRef(false);
  const botTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearTimers = () => {
    clearTimeout(botTimer.current);
    clearTimeout(advanceTimer.current);
  };

  useEffect(() => clearTimers, []);
  useEffect(() => onPlayingChange(phase === 'playing'), [phase, onPlayingChange]);

  const addScore = (who: 'user' | 'bot', pts: number) => {
    scoresRef.current = { ...scoresRef.current, [who]: scoresRef.current[who] + pts };
    setScores(scoresRef.current);
  };

  const applyBot = () => {
    const turn = botRef.current;
    if (!turn || turn.answered) return;
    botRef.current = { ...turn, answered: true };
    if (turn.correct) addScore('bot', points(turn.time));
    setBot(botRef.current);
  };

  const startQuestion = (i: number) => {
    const q = questionsRef.current[i]!;
    const correct = Math.random() < BOT_ACCURACY;
    const wrong = [0, 1, 2, 3].filter((x) => x !== q.answer);
    botRef.current = {
      correct,
      choice: correct ? q.answer : wrong[Math.floor(Math.random() * wrong.length)]!,
      time: 1.6 + Math.random() * 4.4,
      answered: false,
    };
    setBot(botRef.current);
    questionStartRef.current = Date.now();
    setIndex(i);
    setSelected(null);
    clearTimeout(botTimer.current);
    botTimer.current = setTimeout(applyBot, botRef.current.time * 1000);
  };

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearTimeout(botTimer.current);
    clearTimeout(advanceTimer.current);
    const { user, bot: botScore } = scoresRef.current;
    const result: DuelOutcome = user > botScore ? 'win' : user < botScore ? 'lose' : 'draw';
    recordDuel(result, correctSubjects.current);
    setOutcome(result);
    setPhase('result');
    void Haptics.notificationAsync(
      result === 'win' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    );
  }, [recordDuel]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n - startRef.current >= TOTAL_MS) finish();
    }, 100);
    return () => clearInterval(id);
  }, [phase, finish]);

  const start = () => {
    const qs = buildBattleQuiz(combo);
    questionsRef.current = qs;
    setQuestions(qs);
    scoresRef.current = { user: 0, bot: 0 };
    setScores(scoresRef.current);
    correctSubjects.current = [];
    finishedRef.current = false;
    setOutcome(null);
    startRef.current = Date.now();
    setNow(startRef.current);
    setPhase('playing');
    startQuestion(0);
  };

  const answer = (choice: number) => {
    if (selected !== null || phase !== 'playing') return;
    const q = questionsRef.current[index]!;
    const seconds = (Date.now() - questionStartRef.current) / 1000;
    const correct = choice === q.answer;
    if (correct) {
      addScore('user', points(seconds));
      correctSubjects.current.push(q.subject);
    }
    setSelected(choice);
    void Haptics.impactAsync(correct ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Heavy);
    const nextIndex = index + 1;
    advanceTimer.current = setTimeout(() => {
      applyBot(); // the bot answers in its own time; if it was slower than you, reveal it now
      if (nextIndex >= questionsRef.current.length) finish();
      else startQuestion(nextIndex);
    }, REVEAL_MS);
  };

  if (phase === 'lobby') {
    return (
      <View style={styles.lobby}>
        <Orb mood="happy" size={120} />
        <Text style={styles.lobbyTitle}>{t('battleTitle')}</Text>
        <Text style={styles.lobbyText}>{t('battleRules')}</Text>
        <Text style={styles.lobbyReward}>{t('battleRewards')}</Text>
        <PrimaryButton label={t('startBattle')} onPress={start} style={styles.wide} />
        <Text style={styles.record}>{t('record', { w: arena.wins, l: arena.losses, d: arena.draws })}</Text>
      </View>
    );
  }

  if (phase === 'result' && outcome) {
    const titleKey: Record<DuelOutcome, StringKey> = { win: 'win', lose: 'lose', draw: 'draw' };
    const subKey: Record<DuelOutcome, StringKey> = { win: 'winSub', lose: 'loseSub', draw: 'drawSub' };
    return (
      <Animated.View entering={ZoomIn.duration(300)} style={styles.lobby}>
        <Orb mood={outcome === 'lose' ? 'hungry' : 'happy'} size={110} />
        <Text style={[styles.resultTitle, { color: outcome === 'win' ? colors.lime : colors.text }]}>{t(titleKey[outcome])}</Text>
        <Text style={styles.resultScore}>
          {scores.user} : {scores.bot}
        </Text>
        <Text style={styles.lobbyText}>{t(subKey[outcome])}</Text>
        <PrimaryButton label={t('playAgain')} onPress={start} style={styles.wide} />
        <Text style={styles.record}>{t('record', { w: arena.wins, l: arena.losses, d: arena.draws })}</Text>
      </Animated.View>
    );
  }

  const q = questions[index];
  if (!q) return null;
  const text = q[lang];
  const remainingMs = Math.max(0, TOTAL_MS - (now - startRef.current));
  const questionSeconds = selected === null ? Math.max(0, (now - questionStartRef.current) / 1000) : null;
  const revealed = selected !== null;

  return (
    <View style={styles.play}>
      <View style={styles.scoreboard}>
        <View style={styles.side}>
          <Text style={styles.sideLabel}>{t('you')}</Text>
          <Text style={styles.sideScore}>{scores.user}</Text>
        </View>
        <View style={styles.timer}>
          <Text style={[styles.timerText, remainingMs < 10_000 && { color: colors.red }]}>{Math.ceil(remainingMs / 1000)}</Text>
        </View>
        <View style={[styles.side, styles.sideRight]}>
          <Text style={styles.sideLabel}>{t('bot')}</Text>
          <Text style={styles.sideScore}>{scores.bot}</Text>
        </View>
      </View>
      <View style={styles.timeTrack}>
        <View style={[styles.timeFill, { width: `${(remainingMs / TOTAL_MS) * 100}%` as const }]} />
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>{t('questionShort', { i: index + 1, n: questions.length })}</Text>
        <Text style={styles.meta}>{questionSeconds !== null ? `${questionSeconds.toFixed(1)} s` : ''}</Text>
      </View>

      <Animated.View key={q.id} entering={FadeIn.duration(220)} style={styles.questionCard}>
        <Text style={styles.questionText}>{text.q}</Text>
      </Animated.View>

      <Text style={styles.botStatus}>
        {bot?.answered
          ? `${t('botAnswered', { s: bot.time.toFixed(1) })}${revealed ? (bot.correct ? ' ✓' : ' ✗') : ''}`
          : t('botThinking')}
      </Text>

      <View style={styles.tiles}>
        {text.options.map((option, i) => {
          const tile = answerTiles[i % answerTiles.length]!;
          const isCorrect = i === q.answer;
          const dim = revealed && !isCorrect;
          return (
            <Pressable
              key={i}
              onPress={() => answer(i)}
              disabled={revealed}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: tile.color, opacity: dim ? (i === selected ? 0.55 : 0.25) : pressed ? 0.85 : 1 },
                revealed && isCorrect && styles.tileCorrect,
              ]}
            >
              <Text style={styles.tileShape}>{tile.shape}</Text>
              <Text style={styles.tileText} numberOfLines={3} adjustsFontSizeToFit>
                {option}
              </Text>
              {revealed && (isCorrect || i === selected) && <Text style={styles.tileMark}>{isCorrect ? '✓' : '✗'}</Text>}
              {revealed && bot?.answered && bot.choice === i && (
                <View style={styles.botMark}>
                  <Text style={styles.botMarkText}>AI</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── League ──────────────────────────────────────────────────────────────

function League() {
  const t = useT();
  const name = useUserStore((s) => s.name);
  const xp = useUserStore((s) => s.xp);
  const [tab, setTab] = useState<'students' | 'schools'>('students');

  const rows = useMemo(
    () =>
      [...LEAGUE_STUDENTS.map((s) => ({ ...s, me: false })), { name, school: t('you'), xp, me: true }].sort(
        (a, b) => b.xp - a.xp,
      ),
    [name, xp, t],
  );
  const myRank = rows.findIndex((r) => r.me) + 1;
  const top = rows.slice(0, 10);
  const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank));

  return (
    <ScrollView contentContainerStyle={styles.league} showsVerticalScrollIndicator={false}>
      <View style={styles.leagueTabs}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'students', label: t('leagueStudents') },
            { value: 'schools', label: t('leagueSchools') },
          ]}
        />
      </View>
      <Text style={styles.leagueHint}>{t('leagueHint')}</Text>

      {tab === 'students' ? (
        <Card style={styles.listCard}>
          {top.map((r, i) => (
            <View key={`${r.name}-${i}`} style={[styles.listRow, r.me && styles.meRow]}>
              <Text style={styles.rank}>{medal(i + 1)}</Text>
              <View style={[styles.avatar, r.me && { backgroundColor: colors.lime }]}>
                <Text style={[styles.avatarText, r.me && { color: colors.limeInk }]}>{initials(r.name)}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {r.school}
                </Text>
              </View>
              <Text style={styles.rowXp}>{r.xp.toLocaleString('ru-RU')} XP</Text>
            </View>
          ))}
          {myRank > 10 && (
            <>
              <Text style={styles.gap}>···</Text>
              <View style={[styles.listRow, styles.meRow]}>
                <Text style={styles.rank}>{myRank}</Text>
                <View style={[styles.avatar, { backgroundColor: colors.lime }]}>
                  <Text style={[styles.avatarText, { color: colors.limeInk }]}>{initials(name)}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.rowName}>{name}</Text>
                  <Text style={styles.rowSub}>{t('yourRank')}</Text>
                </View>
                <Text style={styles.rowXp}>{xp.toLocaleString('ru-RU')} XP</Text>
              </View>
            </>
          )}
        </Card>
      ) : (
        <Card style={styles.listCard}>
          {LEAGUE_SCHOOLS.map((s, i) => (
            <View key={`${s.name}-${s.city}`} style={styles.listRow}>
              <Text style={styles.rank}>{medal(i + 1)}</Text>
              <View style={styles.flex}>
                <Text style={styles.rowName}>
                  {s.name}, {s.city}
                </Text>
                <Text style={styles.rowSub}>{t('studentsCount', { n: s.students })}</Text>
              </View>
              <Text style={styles.rowXp}>{s.xp.toLocaleString('ru-RU')} XP</Text>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────

export function ArenaScreen({ onBattleChange }: { onBattleChange: (playing: boolean) => void }) {
  const t = useT();
  const [segment, setSegment] = useState<'battle' | 'league'>('battle');
  const [playing, setPlaying] = useState(false);

  const handlePlaying = useCallback(
    (p: boolean) => {
      setPlaying(p);
      onBattleChange(p);
    },
    [onBattleChange],
  );

  return (
    <View style={styles.flex}>
      {!playing && (
        <View style={styles.segment}>
          <Segmented
            value={segment}
            onChange={setSegment}
            options={[
              { value: 'battle', label: t('segBattle') },
              { value: 'league', label: t('segLeague') },
            ]}
          />
        </View>
      )}
      {segment === 'battle' ? <Battle onPlayingChange={handlePlaying} /> : <League />}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  segment: { paddingHorizontal: 16, paddingTop: 8 },
  wide: { alignSelf: 'stretch', marginTop: 8 },
  lobby: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 10 },
  lobbyTitle: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 8 },
  lobbyText: { color: colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  lobbyReward: { color: colors.lime, fontSize: 14, fontWeight: '700' },
  record: { color: colors.faint, fontSize: 12, marginTop: 4 },
  resultTitle: { fontSize: 32, fontWeight: '900', marginTop: 8 },
  resultScore: { color: colors.text, fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  play: { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  scoreboard: { flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1 },
  sideRight: { alignItems: 'flex-end' },
  sideLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  sideScore: { color: colors.text, fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },
  timer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: { color: colors.text, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timeTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 12, overflow: 'hidden' },
  timeFill: { height: '100%', backgroundColor: colors.lime },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  meta: { color: colors.faint, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  questionCard: {
    marginTop: 8,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 96,
    justifyContent: 'center',
  },
  questionText: { color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: '600', textAlign: 'center' },
  botStatus: { color: colors.muted, fontSize: 12, textAlign: 'center', marginVertical: 10 },
  tiles: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '46%',
    flexGrow: 1,
    minHeight: 84,
    borderRadius: radius.md,
    padding: 12,
    justifyContent: 'space-between',
  },
  tileCorrect: { borderWidth: 3, borderColor: '#FFFFFF' },
  tileShape: { color: 'rgba(255,255,255,0.85)', fontSize: 16 },
  tileText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  tileMark: { position: 'absolute', top: 8, right: 10, color: '#fff', fontSize: 20, fontWeight: '900' },
  botMark: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  botMarkText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  league: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  leagueTabs: { alignSelf: 'center', width: 240 },
  leagueHint: { color: colors.faint, fontSize: 11, textAlign: 'center', marginVertical: 10 },
  listCard: { paddingVertical: 6, paddingHorizontal: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 6, borderRadius: radius.sm },
  meRow: { backgroundColor: 'rgba(212,245,60,0.08)' },
  rank: { width: 26, textAlign: 'center', color: colors.muted, fontSize: 14, fontWeight: '800' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  rowName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  rowSub: { color: colors.faint, fontSize: 12 },
  rowXp: { color: colors.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  gap: { color: colors.faint, textAlign: 'center' },
});
