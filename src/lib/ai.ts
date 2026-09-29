import { fetch as streamingFetch } from 'expo/fetch';
import type { Lang } from '@/i18n/types';
import { mockTutorReply, type TutorContext } from './mockTutor';

/**
 * AI client. With EXPO_PUBLIC_AI_ENDPOINT set, requests go to the edge functions in
 * /supabase/functions (DeepSeek chat streaming + Whisper transcription) — API keys
 * never ship inside the app. Without it, the offline tutor answers locally.
 */

const ENDPOINT = process.env.EXPO_PUBLIC_AI_ENDPOINT?.replace(/\/$/, '');
const ANON_KEY = process.env.EXPO_PUBLIC_AI_ANON_KEY;

export const isAIConfigured = !!ENDPOINT;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamChatOptions {
  messages: ChatTurn[];
  context: TutorContext;
  onToken: (token: string) => void;
  signal?: AbortSignal;
}

const MAX_HISTORY = 12;

function authHeaders(): Record<string, string> {
  return ANON_KEY ? { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY } : {};
}

export class AbortedError extends Error {
  constructor() {
    super('aborted');
    this.name = 'AbortError';
  }
}

export const isAbortError = (e: unknown) => e instanceof Error && e.name === 'AbortError';

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortedError());
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbortedError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Offline answers are "typed out" in small chunks so the UI behaves exactly like real streaming. */
async function streamMock({ messages, context, onToken, signal }: StreamChatOptions): Promise<void> {
  const question = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const answer = mockTutorReply(question, context);
  await sleep(350, signal);
  const chunks = answer.match(/\S+\s*/g) ?? [answer];
  for (const chunk of chunks) {
    await sleep(18 + Math.random() * 22, signal);
    onToken(chunk);
  }
}

async function streamRemote({ messages, context, onToken, signal }: StreamChatOptions): Promise<void> {
  const response = await streamingFetch(`${ENDPOINT}/ai-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...authHeaders() },
    body: JSON.stringify({ messages: messages.slice(-MAX_HISTORY), context }),
    signal,
  });
  if (!response.ok || !response.body) throw new Error(`AI endpoint responded ${response.status}`);

  // The edge function relays DeepSeek's OpenAI-compatible SSE stream.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const token: unknown = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (typeof token === 'string' && token.length > 0) onToken(token);
      } catch {
        // Keep-alive or partial line — ignore.
      }
    }
  }
}

export async function streamChat(options: StreamChatOptions): Promise<void> {
  if (!isAIConfigured) return streamMock(options);
  let receivedAny = false;
  const onToken = (t: string) => {
    receivedAny = true;
    options.onToken(t);
  };
  try {
    await streamRemote({ ...options, onToken });
  } catch (e) {
    // Offline or server down before anything arrived: answer from the local tutor instead of failing.
    if (!receivedAny && !isAbortError(e) && !options.signal?.aborted) return streamMock(options);
    throw e;
  }
}

export async function transcribeAudio(uri: string, lang: Lang): Promise<string> {
  if (!isAIConfigured) throw new Error('AI endpoint is not configured');
  const form = new FormData();
  // React Native's FormData accepts a { uri, name, type } file descriptor.
  form.append('file', { uri, name: 'voice.m4a', type: 'audio/m4a' } as unknown as Blob);
  form.append('language', lang);
  const response = await fetch(`${ENDPOINT}/ai-transcribe`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  if (!response.ok) throw new Error(`Transcription failed: ${response.status}`);
  const json = (await response.json()) as { text?: string };
  return (json.text ?? '').trim();
}
