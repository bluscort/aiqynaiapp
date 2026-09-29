import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { useCallback, useState } from 'react';
import type { Lang } from '@/i18n/types';
import { isAIConfigured, transcribeAudio } from '@/lib/ai';

export type VoiceState = 'idle' | 'recording' | 'transcribing';
export type VoiceError = 'unavailable' | 'denied' | 'failed';

/** Tap once to record, tap again to stop → transcribed text is handed to `onText`. */
export function useVoiceInput(lang: Lang, onText: (text: string) => void, onError: (e: VoiceError) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<VoiceState>('idle');

  const start = useCallback(async () => {
    if (!isAIConfigured) return onError('unavailable');
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) return onError('denied');
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setState('recording');
    } catch {
      setState('idle');
      onError('failed');
    }
  }, [recorder, onError]);

  const stop = useCallback(async () => {
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording');
      setState('transcribing');
      const text = await transcribeAudio(uri, lang);
      if (text) onText(text);
      else onError('failed');
    } catch {
      onError('failed');
    } finally {
      setState('idle');
    }
  }, [recorder, lang, onText, onError]);

  const toggle = useCallback(() => {
    if (state === 'idle') void start();
    else if (state === 'recording') void stop();
  }, [state, start, stop]);

  return { state, toggle };
}
