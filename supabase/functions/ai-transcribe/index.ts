// Supabase Edge Function (Deno): speech-to-text for the mic button (Kazakh + Russian).
// Deploy: supabase functions deploy ai-transcribe
// Secret:  supabase secrets set OPENAI_API_KEY=sk-...
import { corsHeaders, json } from '../_shared/cors.ts';

const TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions';
const MODEL = Deno.env.get('TRANSCRIBE_MODEL') ?? 'whisper-1';
const MAX_BYTES = 10 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return json({ error: 'OPENAI_API_KEY is not set' }, 500);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'Expected multipart/form-data' }, 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'Missing "file"' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'Audio too large' }, 413);

  const language = form.get('language');
  const upstreamForm = new FormData();
  upstreamForm.append('file', file, file.name || 'voice.m4a');
  upstreamForm.append('model', MODEL);
  if (language === 'kk' || language === 'ru') upstreamForm.append('language', language);

  const upstream = await fetch(TRANSCRIBE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: upstreamForm,
  });
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return json({ error: 'Upstream error', status: upstream.status, detail: detail.slice(0, 500) }, 502);
  }

  const result = (await upstream.json()) as { text?: string };
  return json({ text: result.text ?? '' });
});
