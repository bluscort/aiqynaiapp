import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ChatInput } from '@/components/ChatInput';
import { ChatThread, type ChatMessage } from '@/components/ChatThread';
import { Orb } from '@/components/Orb';
import { PrimaryButton } from '@/components/ui';
import { getCombo } from '@/data/combos';
import { getUniversity } from '@/data/universities';
import { useMascot } from '@/hooks/useMascot';
import { useVoiceInput, type VoiceError } from '@/hooks/useVoiceInput';
import { useLang, useT, type StringKey } from '@/i18n';
import { isAbortError, streamChat, type ChatTurn } from '@/lib/ai';
import type { Mood } from '@/lib/mascot';
import { useUserStore } from '@/store/userStore';
import { colors, radius } from '@/theme';

const ORB_SIZE = 184;
const HEAD_SCALE = 0.3;
/** Vertical centre of the floating orb head in chat mode. */
const HEAD_CENTER_Y = 30;
const CHAT_TOP_INSET = 64;
const MOOD_CYCLE: (Mood | null)[] = ['happy', 'hungry', 'critical', null];

let msgSeq = 0;
const newId = () => `m${Date.now().toString(36)}${(msgSeq++).toString(36)}`;

export function HomeScreen({ onChatModeChange }: { onChatModeChange: (open: boolean) => void }) {
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
  const inputRef = useRef<TextInput>(null);

  const chatProgress = useSharedValue(0);
  const orbCenterY = useSharedValue(0);

  useEffect(() => {
    chatProgress.value = withTiming(chatOpen ? 1 : 0, { duration: 460, easing: Easing.out(Easing.cubic) });
    onChatModeChange(chatOpen);
  }, [chatOpen, chatProgress, onChatModeChange]);

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
      setChatOpen(true);
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
    [streaming, messages, lang, name, uni, combo, grade, t],
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

  const cycleMoodPreview = () => {
    const i = MOOD_CYCLE.indexOf(moodPreview);
    setMoodPreview(MOOD_CYCLE[(i + 1) % MOOD_CYCLE.length] ?? null);
  };

  // ── Animations ─────────────────────────────────────────────────────────
  const orbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: chatProgress.value * (HEAD_CENTER_Y - orbCenterY.value) },
      { scale: interpolate(chatProgress.value, [0, 1], [1, HEAD_SCALE]) },
    ],
  }));
  const heroFade = useAnimatedStyle(() => ({
    opacity: interpolate(chatProgress.value, [0, 0.5], [1, 0], 'clamp'),
    transform: [{ translateY: chatProgress.value * 16 }],
  }));
  const chatLayer = useAnimatedStyle(() => ({
    opacity: interpolate(chatProgress.value, [0.2, 1], [0, 1], 'clamp'),
    transform: [{ translateY: (1 - chatProgress.value) * 60 }],
  }));

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <View style={styles.flex}>
        <Animated.View style={[StyleSheet.absoluteFill, chatLayer]} pointerEvents={chatOpen ? 'auto' : 'none'}>
          <ChatThread messages={messages} topInset={CHAT_TOP_INSET} onSuggestion={(s) => void send(s)} />
          <Pressable onPress={closeChat} style={styles.endBtn} hitSlop={8} accessibilityRole="button">
            <Text style={styles.endText}>{t('endDialog')}</Text>
          </Pressable>
        </Animated.View>

        <View style={styles.hero} pointerEvents="box-none">
          <Animated.View style={[styles.bubble, heroFade]} pointerEvents={chatOpen ? 'none' : 'auto'}>
            <Text style={styles.bubbleText}>{bubble}</Text>
            <View style={styles.bubbleTail} />
          </Animated.View>

          <Animated.View
            style={orbStyle}
            onLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              orbCenterY.value = y + height / 2;
            }}
          >
            <Orb
              mood={mascot.mood}
              size={ORB_SIZE}
              thinking={streaming}
              onLongPress={chatOpen ? undefined : cycleMoodPreview}
            />
          </Animated.View>

          <Animated.View style={[styles.below, heroFade]} pointerEvents={chatOpen ? 'none' : 'auto'}>
            <View style={styles.satietyRow}>
              <View style={styles.satietyTrack}>
                <View
                  style={[
                    styles.satietyFill,
                    {
                      width: `${mascot.satiety}%` as const,
                      backgroundColor: mascot.mood === 'happy' ? colors.cyan : mascot.mood === 'hungry' ? colors.amber : colors.red,
                    },
                  ]}
                />
              </View>
              <Text style={styles.satietyText}>{t('satiety', { n: mascot.satiety })}</Text>
            </View>
            <PrimaryButton label={cta} onPress={() => router.push('/daily-quiz')} style={styles.cta} />
            {moodPreview && <Text style={styles.preview}>preview: {moodPreview}</Text>}
          </Animated.View>
        </View>
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
        onFocus={() => setChatOpen(true)}
        onSend={() => void send(input)}
        onMic={() => {
          setChatOpen(true);
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
  hero: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    maxWidth: 320,
    marginBottom: 18,
  },
  bubbleText: { color: colors.text, fontSize: 16, lineHeight: 22, textAlign: 'center', fontWeight: '500' },
  bubbleTail: {
    position: 'absolute',
    bottom: -7,
    alignSelf: 'center',
    width: 14,
    height: 14,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    transform: [{ rotate: '45deg' }],
  },
  below: { alignItems: 'center', marginTop: 18, gap: 14, width: '100%' },
  satietyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  satietyTrack: { width: 120, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  satietyFill: { height: '100%', borderRadius: 2 },
  satietyText: { color: colors.muted, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  cta: { minWidth: 220 },
  preview: { color: colors.faint, fontSize: 11 },
  endBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  endText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  notice: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingHorizontal: 24, paddingTop: 4 },
});
