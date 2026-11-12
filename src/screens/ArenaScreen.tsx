import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Orb } from '@/components/Orb';
import { Badge, Card, PrimaryButton, Segmented } from '@/components/ui';
import type { Subject } from '@/data/combos';
import { LEAGUE_SCHOOLS, LEAGUE_STUDENTS } from '@/data/leaderboard';
import type { Question } from '@/data/questions';
import { useLang, useT, type StringKey } from '@/i18n';
import { initials } from '@/lib/format';
import { buildBattleQuiz } from '@/lib/quiz';
import { DUEL_REWARDS, useUserStore, type DuelOutcome } from '@/store/userStore';
import { answerTiles, colors, gradients, medalColors, radius, tints } from '@/theme';

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

/** Win / loss / draw record as three mini cards. */
function RecordCards({ wins, losses, draws }: { wins: number; losses: number; draws: number }) {
  const t = useT();
  const items = [
    { label: t('wins'), value: wins, color: colors.green },
    { label: t('losses'), value: losses, color: colors.red },
    { label: t('draws'), value: draws, color: colors.text },
  ];
  return (
    <View style={styles.recordRow}>
      {items.map((s) => (
        <View key={s.label} style={styles.recordCard}>
          <Text style={[styles.recordValue, { color: s.color }]}>{s.value}</Text>
          <Text style={styles.recordLabel} numberOfLines={1}>
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

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
      <ScrollView contentContainerStyle={styles.lobby} showsVerticalScrollIndicator={false}>
        <Card style={styles.lobbyCard}>
          <LinearGradient colors={gradients.cyanGlow} style={styles.lobbyGlow} pointerEvents="none" />
          <Orb mood="happy" size={92} />
          <Text style={styles.lobbyTitle}>{t('battleTitle')}</Text>
          <Text style={styles.lobbyText}>{t('battleRules')}</Text>
          <View style={styles.rewardBlock}>
            <Text style={styles.rewardLabel}>{t('rewardLabel')}</Text>
            <View style={styles.rewardRow}>
              <Badge label={`+${DUEL_REWARDS.win.xp} XP`} />
              <Badge label={`+${DUEL_REWARDS.win.coins} 🪙`} tone="amber" />
            </View>
          </View>
          <PrimaryButton label={t('startBattle')} onPress={start} style={styles.wide} />
        </Card>
        <RecordCards wins={arena.wins} losses={arena.losses} draws={arena.draws} />
      </ScrollView>
    );
  }

  if (phase === 'result' && outcome) {
    const titleKey: Record<DuelOutcome, StringKey> = { win: 'win', lose: 'lose', draw: 'draw' };
    const subKey: Record<DuelOutcome, StringKey> = { win: 'winSub', lose: 'loseSub', draw: 'drawSub' };
    const reward = DUEL_REWARDS[outcome];
    return (
      <ScrollView contentContainerStyle={styles.lobby} showsVerticalScrollIndicator={false}>
        <Animated.View entering={ZoomIn.duration(300)}>
          <Card style={styles.lobbyCard}>
            <Orb mood={outcome === 'lose' ? 'hungry' : 'happy'} size={92} />
            <Text style={[styles.resultTitle, { color: outcome === 'win' ? colors.lime : colors.text }]}>{t(titleKey[outcome])}</Text>
            <Text style={styles.resultScore}>
              {scores.user} : {scores.bot}
            </Text>
            <Text style={styles.lobbyText}>{t(subKey[outcome])}</Text>
            <View style={styles.rewardRow}>
              <Badge label={`+${reward.xp} XP`} />
              {reward.coins > 0 && <Badge label={`+${reward.coins} 🪙`} tone="amber" />}
            </View>
            <PrimaryButton label={t('playAgain')} onPress={start} style={styles.wide} />
          </Card>
        </Animated.View>
        <RecordCards wins={arena.wins} losses={arena.losses} draws={arena.draws} />
      </ScrollView>
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

      <Animated.View key={q.id} entering={FadeIn.duration(220)}>
        <Card style={styles.questionCard}>
          <Text style={styles.questionText}>{text.q}</Text>
        </Card>
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
          const isWrongPick = revealed && i === selected && !isCorrect;
          return (
            <Pressable
              key={i}
              onPress={() => answer(i)}
              disabled={revealed}
              style={({ pressed }) => [
                styles.tile,
                { borderColor: tile.border, shadowColor: tile.color },
                pressed && { backgroundColor: tile.bg },
                revealed && isCorrect && styles.tileCorrect,
                isWrongPick && styles.tileWrong,
                revealed && !isCorrect && !isWrongPick && styles.tileDim,
              ]}
            >
              <View style={styles.tileHead}>
                <View style={[styles.letter, { backgroundColor: tile.bg, borderColor: tile.border }]}>
                  <Text style={[styles.letterText, { color: tile.color }]}>{tile.shape}</Text>
                </View>
                <View style={styles.tileMarks}>
                  {revealed && bot?.answered && bot.choice === i && (
                    <View style={styles.botMark}>
                      <Text style={styles.botMarkText}>AI</Text>
                    </View>
                  )}
                  {revealed && isCorrect && <Ionicons name="checkmark-circle" size={22} color={colors.green} />}
                  {isWrongPick && <Ionicons name="close-circle" size={22} color={colors.red} />}
                </View>
              </View>
              <Text style={styles.tileText} numberOfLines={3} adjustsFontSizeToFit>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── League ──

interface LeagueEntry {
  key: string;
  title: string;
  sub: string;
  xp: number;
  me: boolean;
  /** Initials for the avatar; schools have none. */
  avatar?: string;
}

function LeagueRow({ rank, entry }: { rank: number; entry: LeagueEntry }) {
  const medal = medalColors[rank - 1];
  return (
    <View
      style={[
        styles.listRow,
        medal ? [styles.podiumRow, { borderColor: `${medal}99`, backgroundColor: `${medal}14` }] : entry.me && styles.meRow,
      ]}
    >
      {medal ? (
        <View style={[styles.rankBadge, { borderColor: medal, backgroundColor: `${medal}26` }]}>
          <Text style={[styles.rankBadgeText, { color: medal }]}>{rank}</Text>
        </View>
      ) : (
        <Text style={styles.rank}>{rank}</Text>
      )}
      {entry.avatar !== undefined && (
        <View style={[styles.avatar, entry.me && { backgroundColor: colors.lime }]}>
          <Text style={[styles.avatarText, entry.me && { color: colors.limeInk }]}>{entry.avatar}</Text>
        </View>
      )}
      <View style={styles.flex}>
        <Text style={styles.rowName} numberOfLines={1}>
          {entry.title}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {entry.sub}
        </Text>
      </View>
      <Text style={[styles.rowXp, medal && { color: medal }]}>{entry.xp.toLocaleString('ru-RU')} XP</Text>
    </View>
  );
}

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

  const entries: LeagueEntry[] =
    tab === 'students'
      ? rows.slice(0, 10).map((r, i) => ({
          key: `${r.name}-${i}`,
          title: r.name,
          sub: r.school,
          xp: r.xp,
          me: r.me,
          avatar: initials(r.name),
        }))
      : LEAGUE_SCHOOLS.map((s) => ({
          key: `${s.name}-${s.city}`,
          title: `${s.name}, ${s.city}`,
          sub: t('studentsCount', { n: s.students }),
          xp: s.xp,
          me: false,
        }));
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  const meBelow = tab === 'students' && myRank > 10;

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

      <View style={styles.podium}>
        {podium.map((entry, i) => (
          <LeagueRow key={entry.key} rank={i + 1} entry={entry} />
        ))}
      </View>

      {(rest.length > 0 || meBelow) && (
        <Card style={styles.listCard}>
          {rest.map((entry, i) => (
            <LeagueRow key={entry.key} rank={i + 4} entry={entry} />
          ))}
          {meBelow && (
            <>
              <Text style={styles.gap}>···</Text>
              <LeagueRow rank={myRank} entry={{ key: 'me', title: name, sub: t('yourRank'), xp, me: true, avatar: initials(name) }} />
            </>
          )}
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
  wide: { alignSelf: 'stretch', marginTop: 4 },
  lobby: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  lobbyCard: { alignItems: 'center', gap: 12, padding: 20 },
  lobbyGlow: { ...StyleSheet.absoluteFill, borderRadius: radius.xl - 1 },
  lobbyTitle: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  lobbyText: { color: colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  rewardBlock: { alignItems: 'center', gap: 8 },
  rewardLabel: { color: colors.faint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  rewardRow: { flexDirection: 'row', gap: 8 },
  recordRow: { flexDirection: 'row', gap: 8 },
  recordCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recordValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  recordLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 2 },
  resultTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
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
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: { color: colors.text, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timeTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 12, overflow: 'hidden' },
  timeFill: { height: '100%', borderRadius: 3, backgroundColor: colors.lime },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  meta: { color: colors.faint, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  questionCard: { marginTop: 8, padding: 18, minHeight: 96, justifyContent: 'center' },
  questionText: { color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: '600', textAlign: 'center' },
  botStatus: { color: colors.muted, fontSize: 12, textAlign: 'center', marginVertical: 10 },
  tiles: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // Dark card; the option's own colour lives in the border, the glow and the letter badge.
  tile: {
    width: '46%',
    flexGrow: 1,
    minHeight: 84,
    borderRadius: radius.md,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
    padding: 12,
    justifyContent: 'space-between',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  tileCorrect: { borderColor: colors.green, backgroundColor: tints.green.bg, shadowColor: colors.green },
  tileWrong: { borderColor: colors.red, backgroundColor: tints.red.bg, shadowColor: colors.red },
  tileDim: { opacity: 0.35 },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileMarks: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  letter: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontSize: 14, fontWeight: '900' },
  tileText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  botMark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  botMarkText: { color: colors.text, fontSize: 10, fontWeight: '900' },
  league: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  leagueTabs: { alignSelf: 'center', width: 240 },
  leagueHint: { color: colors.faint, fontSize: 11, textAlign: 'center', marginVertical: 10 },
  podium: { gap: 8, marginBottom: 10 },
  podiumRow: { borderWidth: 1, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 12 },
  listCard: { paddingVertical: 6, paddingHorizontal: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 6, borderRadius: radius.sm },
  meRow: { backgroundColor: tints.lime.bg },
  rank: { width: 28, textAlign: 'center', color: colors.muted, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  rankBadge: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rankBadgeText: { fontSize: 13, fontWeight: '900' },
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
