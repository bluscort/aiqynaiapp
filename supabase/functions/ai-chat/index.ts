// Supabase Edge Function (Deno): streams DeepSeek chat completions to the app as SSE.
// Deploy: supabase functions deploy ai-chat
// Secret:  supabase secrets set DEEPSEEK_API_KEY=sk-...
import { corsHeaders, json } from '../_shared/cors.ts';
import { retrieve } from '../_shared/knowledge.ts';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = Deno.env.get('DEEPSEEK_MODEL') ?? 'deepseek-chat';
const MAX_MESSAGES = 12;
const MAX_CHARS = 4000;

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface TutorContext {
  language?: 'ru' | 'kk';
  name?: string;
  universityShort?: string;
  comboLabel?: string;
  grade?: number;
}

function sanitize(messages: unknown): ChatTurn[] | null {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const out: ChatTurn[] = [];
  for (const m of messages.slice(-MAX_MESSAGES)) {
    if (!m || typeof m !== 'object') return null;
    const { role, content } = m as Record<string, unknown>;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return null;
    out.push({ role, content: content.slice(0, MAX_CHARS) });
  }
  return out[out.length - 1]?.role === 'user' ? out : null;
}

function systemPrompt(ctx: TutorContext, facts: string[]): string {
  const lang = ctx.language === 'kk' ? 'казахском' : 'русском';
  return [
    'Ты — Aiqyn, дружелюбный AI-ментор для школьников Казахстана, готовящихся к ЕНТ и поступлению на грант.',
    `Отвечай на ${lang} языке (если ученик пишет на другом языке — отвечай на его языке). Тон: тёплый, мотивирующий, как старший брат или сестра; допустим лёгкий подростковый сленг, без фамильярности.`,
    'Задачи по математике, физике, химии решай пошагово: нумерованные шаги, жирные заголовки (**...**), в конце — проверка и чёткий ответ.',
    'НЕ используй LaTeX. Пиши формулы Unicode-символами: x², √, ·, −, ≤, π, индексы x₁.',
    'По грантам, квотам, пороговым баллам и ГОП опирайся только на факты ниже и общеизвестные правила МНВО РК. Если не уверен в цифре — прямо скажи, что это ориентир, и посоветуй проверить на testcenter.kz. Никогда не выдумывай проходные баллы.',
    'Ответ — не длиннее 180 слов, если ученик не просит подробнее. Где уместно, предлагай открыть Матчер (расчёт 4 комбинаций ГОП) или Арену.',
    `Профиль ученика: имя ${ctx.name ?? '—'}, ${ctx.grade ?? 11} класс, профиль ${ctx.comboLabel ?? '—'}, целевой вуз ${ctx.universityShort ?? '—'}.`,
    facts.length ? `Факты из базы знаний:\n- ${facts.join('\n- ')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (!apiKey) return json({ error: 'DEEPSEEK_API_KEY is not set' }, 500);

  let body: { messages?: unknown; context?: TutorContext };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const messages = sanitize(body.messages);
  if (!messages) return json({ error: 'messages must be a non-empty array ending with a user turn' }, 400);
  const context = body.context ?? {};
  const facts = retrieve(messages[messages.length - 1]!.content);

  const upstream = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      temperature: 0.4,
      max_tokens: 900,
      messages: [{ role: 'system', content: systemPrompt(context, facts) }, ...messages],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return json({ error: 'Upstream error', status: upstream.status, detail: detail.slice(0, 500) }, 502);
  }

  // DeepSeek already speaks OpenAI-style SSE ("data: {...}\n\n" … "data: [DONE]") — relay it as is.
  return new Response(upstream.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
});
