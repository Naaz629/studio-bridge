You are helping me connect my existing Student UI to a Tutor UI so that what students do is seen live by the tutor, and what the tutor does is seen live by students. Do the work step by step, show the full code for every file you create or change, and do not break the existing screens.

## My project
- Repo: https://github.com/dlua0926/Studio-Bridge (React 19, Vite, TypeScript, Tailwind 4, pnpm, hosted on Vercel).
- Relevant files: `src/App.tsx`, `src/MyLearning.tsx`, `src/ExtraActivity.tsx`, `src/activity-state.ts` (a reducer holding `ActivityRun[]` with actions `select`, `submit`, `play`, `photo`), `src/peer-discussion.ts` (a reducer for peer replies), slides in `public/assets/slides/week6/page-01.jpg ... page-19.jpg`.
- Activity kinds today: `choice`, `rating`, `discussion` (5 cards: 0 Agree, 1 Disagree, 2 Take a turn, 3 Clarify, 4 Share an idea) and `artefact` (photo with name, group, caption). Everything is in memory only, nothing is saved.
- The Tutor UI is a separate app (https://studio-bridge-theta.vercel.app, repo https://github.com/Naaz629/studio-bridge). The shared data contract is here and is the source of truth: https://github.com/Naaz629/studio-bridge/blob/main/supabase/DATA-CONTRACT.md

## The shared backend (Supabase, already created and set up)
- URL: `https://nqalksankethoskforml.supabase.co`
- Public anon key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xYWxrc2Fua2V0aG9za2Zvcm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1MTExMDQsImV4cCI6MjEwOTA4NzEwNH0.qEUGoFSJ0daEi_pXkAzibT9PUhmZ7rmlfO8UrRMBgf8`
- Never use or ask for the service_role key. Put the URL and key in Vite env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (a local `.env.local`, and the same two variables in the Vercel project settings, then redeploy).
- Realtime is switched on for all tables. Row access is open for the demo (anyone with a class code can read and write that class).

### Tables (all have a `session` text column = the 4-letter class code)
- `sessions(code pk, unit, week, state jsonb)`. The tutor keeps `state = { slide, activityId, activityKind, updatedAt }` up to date. Students only READ this.
- `activities(id, session, kind, slide, spec jsonb)`. `kind` is `concept | qa | discussion | artefact | reflection`. The tutor writes them. For `concept`, `spec.questions` is an array of 5 questions `{ level, label, type: 'mc'|'scale'|'open', text, options?: [{t, ok}], lo?, hi?, hint? }`. For `reflection`, `spec = { question, hint }`. Students only READ these.
- `questions(id uuid, session, student, anonymous bool, text, text_en, lang, slide, upvotes int default 1, status 'open'|'ans', answer, created_at)`. Students INSERT (and may bump `upvotes`). The tutor sets `status` and `answer`.
- `reactions(id, session, kind, student, created_at)`, `kind` is one of `got | think | confused | insight | applause`. Students INSERT.
- `responses(id uuid, session, activity_id text, kind text, student text, team text, payload jsonb, created_at)`. Students INSERT.
- `events(id, session, role 'tutor'|'student', type, actor, payload jsonb, created_at)`. Append-only log. Every student action also inserts a row here.
- Storage: a public bucket named `artefacts` for photos.

## What to build in my Student UI
1. **Supabase client** `src/supabase.ts` using `@supabase/supabase-js` (`pnpm add @supabase/supabase-js`) and the two env vars.
2. **Join screen**: before the app, ask for the student's name (or a tick for "Anonymous") and the 4-letter class code. Check the code exists in `sessions` (case-insensitive, store it uppercase). Keep `{ code, name, anonymous }` in `localStorage` so a refresh does not log them out. Show the class code in the header with a "Leave class" button.
3. **Live class state** `src/class-session.ts` (a React hook or context): subscribes with Supabase Realtime (`postgres_changes`, filter `session=eq.<code>` or `code=eq.<code>` for `sessions`) to `sessions` and `activities`, and exposes `{ state, activities }`. When `state.slide` changes, show that slide. When `state.activityId` is set, open that activity for the student. When it is null, show the normal slide view. Load the current rows once on join, then keep them live.
4. **Send student actions** `src/class-api.ts` with small functions. Each one also inserts an `events` row (`role: 'student'`, `actor: name`):
   - `askQuestion({ text, anonymous, slide, lang?, text_en? })` -> insert into `questions`. If the student wrote Chinese, put the Chinese in `text` and an English version in `text_en` (if you can translate it; otherwise leave `text_en` empty).
   - `upvoteQuestion(id)` -> increase `upvotes` by 1 (use an RPC-free update; read-then-write is fine for the demo).
   - `sendReaction(kind)` -> insert into `reactions`.
   - `submitResponse({ activityId, kind, payload, team? })` -> insert into `responses`. Always send `activity_id` exactly as `sessions.state.activityId`. Mapping from the existing reducer actions:
     - choice `select`+`submit` -> `kind:'choice'`, `payload:{ q: <question number 0-4>, answer: <0-3> }`
     - rating `select`+`submit` -> `kind:'rating'`, `payload:{ q: <0-4>, answer: <1-5> }`
     - discussion `play` -> `kind:'discussion'`, `payload:{ card: <0-4> }`
     - written reflection or open answer -> `kind:'reflection'` (or `'open'`), `payload:{ text, lang?, text_en? }`
     - peer discussion `post` -> `kind:'peer_reply'`, `payload:{ parentId, text }`
     - artefact `photo`+`submit` -> upload the file to the `artefacts` bucket at `<code>/<timestamp>-<filename>`, get the public URL, then `kind:'artefact'`, `team`, `payload:{ url, name, caption }`
5. **Wire the existing UI**: keep the current screens and reducers. After a reducer action that should be shared, also call the matching `class-api` function. The activity shown to students should come from the tutor's `activities` rows (use `spec.questions` for concept checks and `spec.question` + `spec.hint` for reflections), falling back to the current built-in sample activities only when the tutor has not set one. Questions asked and reactions sent from the existing UI must go to Supabase.
6. **Offline fallback**: if Supabase is not configured or a call fails, keep working with the in-memory sample data and show a small, quiet "Not connected" note. Never crash the app.
7. **Do not** add authentication, do not use the service_role key, do not change the Tutor UI, and do not rename existing exports unless you update every use.

## How I will test it
1. Open the Tutor UI (https://studio-bridge-theta.vercel.app). It shows a "Class code" chip, for example `K7QF`.
2. Open my Student UI, join with that code and a name.
3. Ask a question and send a reaction in the Student UI: both should appear in the tutor's Questions column and reaction row within a second.
4. In the tutor app, tick a question answered and move to the next slide: the student should see the slide change and the question marked answered.
5. Open Supabase > Table Editor and confirm rows in `questions`, `reactions`, `responses` and `events`.

## Deliverables
- The full contents of every new or changed file, with file paths.
- The exact `pnpm` commands to run and the two Vercel environment variables to add.
- A short list of anything in the existing UI you could not map, with a suggested fix.
- If a table or column in the list above is missing or different from what you need, tell me instead of guessing, and give me the SQL.
