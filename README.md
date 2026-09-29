# AiqynAI — MVP

A pocket AI mentor for UNT (ЕНТ) and grant admission in Kazakhstan. Built with Expo SDK 54, Expo Router, Reanimated 4, Zustand and AsyncStorage.

## Run it

```bash
npm install
npx expo install --fix      # aligns native package versions with your installed Expo SDK
npx expo start              # scan the QR code with Expo Go (iOS / Android)
```

The app works right away in **offline demo mode**. In that mode the tutor solves equations and answers admission questions from the local dataset.

## Connect the live AI (DeepSeek + voice)

The app never holds API keys. It talks to two Supabase Edge Functions in `supabase/functions`:

| Function        | Upstream                          | Secret             |
|-----------------|-----------------------------------|--------------------|
| `ai-chat`       | DeepSeek `deepseek-chat`, streamed as SSE | `DEEPSEEK_API_KEY` |
| `ai-transcribe` | OpenAI Whisper (Kazakh + Russian) | `OPENAI_API_KEY`   |

```bash
supabase link --project-ref <ref>
supabase secrets set DEEPSEEK_API_KEY=sk-... OPENAI_API_KEY=sk-...
supabase functions deploy ai-chat
supabase functions deploy ai-transcribe
cp .env.example .env        # fill in EXPO_PUBLIC_AI_ENDPOINT and EXPO_PUBLIC_AI_ANON_KEY
```

`ai-chat` adds a system prompt (tone, step-by-step format, no LaTeX, no invented cutoffs), the student's profile, and the matching facts from `_shared/knowledge.ts`. This is the RAG layer. If the endpoint can't be reached before any tokens arrive, the app falls back to the offline tutor.

## Structure

```
app/
  _layout.tsx        Stack + store hydration gate
  index.tsx          HUD + PagerView (Home ↔ Matcher ↔ Arena) + page indicator
  daily-quiz.tsx     5 micro-tests that "feed" the orb; hardcore revival mode
  profile.tsx        Modal: name, target uni, grade, subjects, RU/KZ, radar, reminders
src/
  screens/           HomeScreen (orb ↔ chat morph), MatcherScreen, ArenaScreen
  components/        Orb, HUD, PagerIndicator, ChatThread, ChatInput, RichText, RadarChart, ui
  store/userStore.ts Zustand + AsyncStorage persistence (XP, coins, streak, satiety, language…)
  lib/               mascot rules, matcher algorithm, AI client, offline tutor, question generator
  data/              universities & programs, question bank, leaderboard seed
  i18n/              RU / KZ strings
supabase/functions/  edge functions
```

## Mechanics

- **Orb state.** Each correct daily answer adds 20% satiety (resets every day). If you've been fed today with 60% or more, the orb is *happy*: cyan/violet breathing. Otherwise it is *hungry*: slow amber pulse. After 2 or more fully skipped days it goes *critical*: grey body, red dashed outline, jitter. After 5 skipped days the streak burns and only a hardcore test with at least 4 of 5 correct brings the orb back.
- **Demo shortcut.** Long-press the orb to cycle through the moods for demos. Long-press again until "preview" disappears to return to the real state.
- **Smart Matcher.** Grant probability is a logistic curve around each program's cutoff (σ ≈ 5 points). The rural quota uses the rural cutoff, and the social quota takes 4 points off the cutoff. The final plan is 1 Reach, 2 Target and 1 Safety, most ambitious first. You can copy or share it.
- **Arena.** 5 questions in 60 seconds against a bot that is right 68% of the time and answers in 1.6–6 seconds. A correct answer scores 100 points plus a speed bonus of up to 100. A win gives +50 XP and +15 coins.
- **Questions.** Hand-written RU/KZ questions plus generators that create new numeric versions of math, physics and informatics tasks.

## Before production

- The cutoff scores in `src/data/universities.ts` and `_shared/knowledge.ts` are **orientative**. Replace them with official МНВО РК / НЦТ data.
- The leaderboard is a local demo season. It needs a backend table (for example Supabase) for real rankings.
