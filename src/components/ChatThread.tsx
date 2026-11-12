import { useRef, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useT } from '@/i18n';
import { colors, radius } from '@/theme';
import { RichText } from './RichText';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pending?: boolean;
  error?: boolean;
}

export function ChatThread({
  messages,
  topInset,
  onSuggestion,
}: {
  messages: ChatMessage[];
  topInset: number;
  onSuggestion: (text: string) => void;
}) {
  const t = useT();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: topInset }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      showsVerticalScrollIndicator={false}
    >
      {messages.length === 0 ? (
        <View style={styles.intro}>
          <Text style={styles.introText}>{t('chatHello')}</Text>
          <View style={styles.suggestions}>
            {(['sugg1', 'sugg2', 'sugg3', 'sugg4'] as const).map((key) => (
              <Pressable key={key} onPress={() => onSuggestion(t(key))} style={styles.suggestion}>
                <Text style={styles.suggestionText}>{t(key)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        messages.map((m) => (
          <Animated.View
            key={m.id}
            entering={FadeInDown.duration(260)}
            style={[styles.bubble, m.role === 'user' ? styles.user : styles.assistant, m.error && styles.error]}
          >
            {m.role === 'assistant' && m.pending && m.text.length === 0 ? (
              <ActivityIndicator size="small" color={colors.cyan} />
            ) : m.role === 'user' ? (
              <Text style={styles.userText}>{m.text}</Text>
            ) : (
              <RichText text={m.text} style={styles.assistantText} />
            )}
          </Animated.View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  intro: { alignItems: 'center', paddingTop: 8, gap: 10 },
  introText: { color: colors.muted, fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 320 },
  suggestions: { width: '100%', gap: 8, marginTop: 6 },
  suggestion: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: { color: colors.text, fontSize: 14 },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  user: { alignSelf: 'flex-end', backgroundColor: colors.lime, borderBottomRightRadius: 6 },
  assistant: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  error: { borderColor: 'rgba(239,68,68,0.5)' },
  userText: { color: colors.limeInk, fontSize: 15, lineHeight: 21 },
  assistantText: { color: colors.text, fontSize: 15, lineHeight: 22 },
});
