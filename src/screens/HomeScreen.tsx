import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useId, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { ChatInput } from '@/components/ChatInput';
import { ChatThread, type ChatMessage } from '@/components/ChatThread';
import { Orb } from '@/components/Orb';
import { SlimeEffects } from '@/components/SlimeEffects';
import { PrimaryButton } from '@/components/ui';
import { getCombo } from '@/data/combos';
import { getUniversity } from '@/data/universities';
import { useMascot } from '@/hooks/useMascot';
import { useRagdoll } from '@/hooks/useRagdoll';
import { useVoiceInput, type VoiceError } from '@/hooks/useVoiceInput';
import { useLang, useT, type StringKey } from '@/i18n';
import { isAbortError, streamChat, type ChatTurn } from '@/lib/ai';
import type { Mood } from '@/lib/mascot';
import { useUserStore } from '@/store/userStore';
import { colors, gradients, moodAccents, radius } from '@/theme';

const ORB_SIZE = 184;
const HEAD_SCALE = 0.3;
/** Vertical centre of the floating orb head in chat mode. */
const HEAD_CENTER_Y = 30;
const CHAT_TOP_INSET = 64;
const GLOW_SIZE = 460;
const MOOD_CYCLE: (Mood | null)[] = ['happy', 'hungry', 'critical', null];
const MOOD_LABEL: Record<Mood, StringKey> = { happy: 'moodHappy', hungry: 'moodHungry', critical: 'moodCritical' };

let msgSeq = 0;
const newId = () => `m${Date.now().toString(36)}${(msgSeq++).toString(36)}`;

/** Soft radial light behind the orb, tinted by its mood. */
function MoodGlow({ mood }: { mood: Mood }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { glow, glowOpacity } = moodAccents[mood];
  return (
    <Svg width={GLOW_SIZE} height={GLOW_SIZE}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={glow[0]} stopOpacity={glowOpacity} />
          <Stop offset="0.55" stopColor={glow[1]} stopOpacity={glowOpacity * 0.35} />
          <Stop offset="1" stopColor={glow[1]} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

export function HomeScreen({
  onSwipeLockChange,
  keyboardOffset,
}: {
  onSwipeLockChange: (locked: boolean) => void;
  /** Height of everything above this screen (the HUD), so the keyboard never covers the input. */
  keyboardOffset: number;
}) {
  const t = useT();
  const lang = useLang();
  const mascot = useMascot();
  const name = useUserStore((s) => s.name);
  const grade = useUserStore((s) => s.grade);
  const uni = getUniversity(useUserStore((s) => s.targetUniId));
  const combo = getCombo(useUserStore((s) => s.combo));
  const lastFedDate = useUserStore((s) => s.lastFedDate);
  const moodPreview = useUserStore((s) => s.moodPreview);
  const setMoodPreview = useUserStore((s) => s.setMoodPreview);

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const chatProgress = useSharedValue(0);
  const ragdollProgress = useSharedValue(0);
  const ragdoll = useRagdoll(ORB_SIZE / 2);

  useEffect(() => {
    chatProgress.value = withTiming(chatOpen ? 1 : 0, { duration: 460, easing: Easing.out(Easing.cubic) });
  }, [chatOpen, chatProgress]);

  useEffect(() => {
    ragdollProgress.value = withTiming(ragdoll.active ? 1 : 0, { duration: 300 });
  }, [ragdoll.active, ragdollProgress]);

  // Horizontal swipes must drag the orb / scroll the chat, not flip pages.
  useEffect(() => onSwipeLockChange(chatOpen || ragdoll.active), [chatOpen, ragdoll.active, onSwipeLockChange]);

  const { active: ragdollActive, reset: resetRagdoll } = ragdoll;
  const openChat = useCallback(() => {
    if (ragdollActive) resetRagdoll();
    setChatOpen(true);
  }, [ragdollActive, resetRagdoll]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(id);
  }, [notice]);

  // ── Chat ───────────────────────────────────────────────────────────────
  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || streaming) return;
      openChat();
      setInput('');

      const botId = newId();
      const history: ChatTurn[] = [
        ...messages.filter((m) => !m.error && m.text).map((m) => ({ role: m.role, content: m.text })),
        { role: 'user', content: text },
      ];
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: 'user', text },
        { id: botId, role: 'assistant', text: '', pending: true },
      ]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await streamChat({
          messages: history,
          context: { language: lang, name, universityShort: uni.short[lang], comboLabel: combo.short[lang], grade },
          signal: controller.signal,
          onToken: (token) =>
            setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, text: m.text + token } : m))),
        });
      } catch (e) {
        if (!isAbortError(e)) {
          setMessages((prev) =>
            prev.map((m) => (m.id === botId ? { ...m, text: m.text || t('chatError'), error: !m.text } : m)),
          );
        }
      } finally {
        setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, pending: false } : m)));
        if (abortRef.current === controller) abortRef.current = null;
        setStreaming(false);
      }
    },
    [streaming, messages, lang, name, uni, combo, grade, t, openChat],
  );

  const closeChat = () => {
    abortRef.current?.abort();
    Keyboard.dismiss();
    setChatOpen(false);
    setMessages([]);
    setInput('');
  };

  // ── Voice ──────────────────────────────────────────────────────────────
  const onVoiceText = useCallback((text: string) => void send(text), [send]);
  const onVoiceError = useCallback(
    (e: VoiceError) => {
      const key: Record<VoiceError, StringKey> = { unavailable: 'voiceUnavailable', denied: 'voiceDenied', failed: 'voiceFailed' };
      setNotice(t(key[e]));
    },
    [t],
  );
  const voice = useVoiceInput(lang, onVoiceText, onVoiceError);

  // ── Mascot copy ────────────────────────────────────────────────────────
  let bubble: string;
  let cta: string;
  if (mascot.ghost) {
    bubble = t('bubbleGhost');
    cta = t('ctaRevive');
  } else if (mascot.mood === 'critical') {
    bubble = t('bubbleCritical', { days: Math.max(mascot.missedDays, 2) });
    cta = t('ctaReady');
  } else if (mascot.satiety >= 100) {
    bubble = t('bubbleFull');
    cta = t('ctaMore');
  } else if (!lastFedDate) {
    bubble = t('bubbleNew', { name });
    cta = t('ctaReady');
  } else if (mascot.mood === 'hungry') {
    bubble = t('bubbleHungry');
    cta = t('ctaReady');
  } else {
    bubble = t('bubbleHappy');
    cta = t('ctaReady');
  }

  const accent = moodAccents[mascot.mood];
  const moodLabel = t(mascot.ghost ? 'moodGhost' : MOOD_LABEL[mascot.mood]);

  const cycleMoodPreview = () => {
    const i = MOOD_CYCLE.indexOf(moodPreview);
    setMoodPreview(MOOD_CYCLE[(i + 1) % MOOD_CYCLE.length] ?? null);
  };

  // ── Animations ─────────────────────────────────────────────────────────
  const { x: ragX, y: ragY, spin, squash, squashVertical, orbScale, stageH } = ragdoll;
  const orbStyle = useAnimatedStyle(() => {
    // The orb rests at the stage centre; in chat mode it floats up into a small head.
    // orbScale drops to 0 while the orb is a puddle and springs back when it reassembles.
    const scale = interpolate(chatProgress.value, [0, 1], [1, HEAD_SCALE]) * orbScale.value;
    const s = squash.value;
    const vertical = squashVertical.value === 1;
    return {
      transform: [
        { translateX: ragX.value },
        { translateY: ragY.value + chatProgress.value * (HEAD_CENTER_Y - stageH.value / 2) },
        { scaleX: scale * (vertical ? 1 + s * 0.6 : 1 - s) },
        { scaleY: scale * (vertical ? 1 - s : 1 + s * 0.6) },
        { rotate: `${spin.value}rad` },
      ],
    };
  });
  const heroFade = useAnimatedStyle(() => {
    const hidden = Math.max(chatProgress.value, ragdollProgress.value);
    return {
      opacity: interpolate(hidden, [0, 0.5], [1, 0], 'clamp'),
      transform: [{ translateY: hidden * 16 }],
    };
  });
  // The ambient light belongs to the resting orb: it fades when the orb leaves the centre.
  const glowFade = useAnimatedStyle(() => ({ opacity: 1 - Math.max(chatProgress.value, ragdollProgress.value) }));
  const ragdollBar = useAnimatedStyle(() => ({
    opacity: ragdollProgress.value,
    transform: [{ translateY: (1 - ragdollProgress.value) * 20 }],
  }));
  const heroInteractive = !chatOpen && !ragdoll.active;
  const chatLayer = useAnimatedStyle(() => ({
    opacity: interpolate(chatProgress.value, [0.2, 1], [0, 1], 'clamp'),
    transform: [{ translateY: (1 - chatProgress.value) * 60 }],
  }));

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={keyboardOffset}>
      <View style={styles.flex} onLayout={ragdoll.onStageLayout}>
        <Animated.View style={[styles.orbLayer, glowFade]} pointerEvents="none">
          <MoodGlow mood={mascot.mood} />
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, chatLayer]} pointerEvents={chatOpen ? 'auto' : 'none'}>
          <ChatThread messages={messages} topInset={CHAT_TOP_INSET} onSuggestion={(s) => void send(s)} />
          <Pressable onPress={closeChat} style={styles.endBtn} hitSlop={8} accessibilityRole="button">
            <Text style={styles.endText}>{t('endDialog')}</Text>
          </Pressable>
        </Animated.View>

        {/* Equal flexible space above and below the orb slot keeps the orb exactly centred. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={styles.heroTop} pointerEvents="box-none">
            <Animated.View style={[styles.bubble, heroFade]} pointerEvents={heroInteractive ? 'auto' : 'none'}>
              <LinearGradient colors={gradients.cardSolid} style={styles.bubbleFill} />
              <LinearGradient colors={gradients.edge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bubbleEdge} />
              <View style={styles.bubbleTail} />
              <View style={styles.status}>
                <View style={[styles.statusDot, { backgroundColor: mascot.ghost ? colors.red : accent.color }]} />
                <Text style={styles.statusText}>Aiqyn · {moodLabel}</Text>
              </View>
              <Text style={styles.bubbleText}>{bubble}</Text>
            </Animated.View>
          </View>
          <View style={styles.orbSlot} pointerEvents="none" />
          <View style={styles.heroBottom} pointerEvents="box-none">
            <Animated.View style={[styles.below, heroFade]} pointerEvents={heroInteractive ? 'auto' : 'none'}>
              <View style={styles.satietyRow}>
                <Ionicons name="flash" size={15} color={accent.color} />
                <View style={styles.satietyTrack}>
                  <LinearGradient
                    colors={accent.bar}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.satietyFill, { width: `${mascot.satiety}%` as const }]}
                  />
                </View>
                <Text style={styles.satietyText}>{t('satiety', { n: mascot.satiety })}</Text>
              </View>
              <PrimaryButton label={cta} onPress={() => router.push('/daily-quiz')} style={styles.cta} />
              {moodPreview && <Text style={styles.preview}>preview: {moodPreview}</Text>}
            </Animated.View>
          </View>
        </View>

        <SlimeEffects
          mood={mascot.mood}
          splats={ragdoll.splats}
          melted={ragdoll.melted}
          reassembling={ragdoll.reassembling}
          puddleX={ragdoll.puddleX}
          hitX={ragdoll.hitX}
          hitY={ragdoll.hitY}
          stageW={ragdoll.stageW}
          stageH={ragdoll.stageH}
        />

        {/* The orb lives in its own full-stage layer so it can be thrown anywhere and still receive touches. */}
        <View style={styles.orbLayer} pointerEvents="box-none">
          <Animated.View style={orbStyle} {...ragdoll.panHandlers}>
            <Orb
              mood={mascot.mood}
              size={ORB_SIZE}
              thinking={streaming}
              onPress={chatOpen ? undefined : ragdoll.registerTap}
              onLongPress={heroInteractive ? cycleMoodPreview : undefined}
            />
          </Animated.View>
        </View>

        {ragdoll.active && (
          <Animated.View style={[styles.ragdollBar, ragdollBar]} pointerEvents="box-none">
            <Text style={styles.ragdollHint}>{t(ragdoll.melted ? 'ragdollMelted' : 'ragdollHint')}</Text>
            {/* The puddle reassembles by itself; the button keeps its place so the hint doesn't jump. */}
            <Pressable
              onPress={ragdoll.reset}
              disabled={ragdoll.melted}
              style={[styles.ragdollReset, ragdoll.melted && styles.hidden]}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.endText}>{t('ragdollReset')}</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>

      {(notice || voice.state !== 'idle') && (
        <Text style={styles.notice}>
          {voice.state === 'recording' ? t('listening') : voice.state === 'transcribing' ? t('transcribing') : notice}
        </Text>
      )}
      <ChatInput
        ref={inputRef}
        value={input}
        onChangeText={setInput}
        onFocus={openChat}
        onSend={() => void send(input)}
        onMic={() => {
          openChat();
          voice.toggle();
        }}
        voiceState={voice.state}
        busy={streaming}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heroTop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 24 },
  orbSlot: { height: ORB_SIZE },
  heroBottom: { flex: 1, justifyContent: 'flex-start', alignItems: 'center', paddingHorizontal: 24 },
  orbLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  ragdollBar: { position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center', gap: 8 },
  ragdollHint: { color: colors.muted, fontSize: 12 },
  hidden: { opacity: 0 },
  ragdollReset: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  bubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 14,
    maxWidth: 320,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  bubbleFill: { ...StyleSheet.absoluteFill, borderRadius: radius.lg - 1 },
  bubbleEdge: { position: 'absolute', top: 0, left: radius.lg, right: radius.lg, height: 1 },
  bubbleText: { color: colors.text, fontSize: 16, lineHeight: 22, textAlign: 'center', fontWeight: '500' },
  // Matches the bottom colour of the bubble gradient.
  bubbleTail: {
    position: 'absolute',
    bottom: -7,
    alignSelf: 'center',
    width: 14,
    height: 14,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderStrong,
    transform: [{ rotate: '45deg' }],
  },
  // Status badge sits on the top edge of the bubble.
  status: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  below: { alignItems: 'center', marginTop: 18, gap: 14, width: '100%' },
  satietyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  satietyTrack: { width: 120, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  satietyFill: { height: '100%', borderRadius: 4 },
  satietyText: { color: colors.muted, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  cta: { minWidth: 220 },
  preview: { color: colors.faint, fontSize: 11 },
  endBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  endText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  notice: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingHorizontal: 24, paddingTop: 4 },
});
