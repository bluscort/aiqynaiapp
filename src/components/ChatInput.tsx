import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { VoiceState } from '@/hooks/useVoiceInput';
import { useT } from '@/i18n';
import { isAIConfigured } from '@/lib/ai';
import { colors, gradients } from '@/theme';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onSend: () => void;
  onMic: () => void;
  voiceState: VoiceState;
  busy: boolean;
}

export const ChatInput = forwardRef<ComponentRef<typeof TextInput>, Props>(function ChatInput(
  { value, onChangeText, onFocus, onSend, onMic, voiceState, busy },
  ref,
) {
  const t = useT();
  const canSend = value.trim().length > 0 && !busy;

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          placeholder={t('inputPlaceholder')}
          placeholderTextColor={colors.faint}
          style={styles.input}
          multiline
          maxLength={1500}
          selectionColor={colors.lime}
        />
        {/* Speech recognition runs on the AI backend; without it the button would do nothing, so it is not shown. */}
        {isAIConfigured && (
          <Pressable
            onPress={onMic}
            hitSlop={8}
            disabled={voiceState === 'transcribing' || busy}
            style={[styles.iconBtn, voiceState === 'recording' && styles.recording]}
            accessibilityRole="button"
            accessibilityLabel="Voice input"
          >
            {voiceState === 'transcribing' ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Ionicons name={voiceState === 'recording' ? 'stop' : 'mic-outline'} size={20} color={colors.text} />
            )}
          </Pressable>
        )}
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          hitSlop={4}
          style={[styles.send, !canSend && styles.sendDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Send"
        >
          <LinearGradient colors={gradients.primary} style={styles.sendFill} />
          {busy ? (
            <ActivityIndicator size="small" color={colors.limeInk} />
          ) : (
            <Ionicons name="arrow-up" size={20} color={colors.limeInk} />
          )}
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 6 },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 40,
    maxHeight: 120,
    paddingTop: 10,
    paddingBottom: 10,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  recording: { backgroundColor: 'rgba(239,68,68,0.85)' },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendFill: { ...StyleSheet.absoluteFill },
  sendDisabled: { opacity: 0.35 },
});
