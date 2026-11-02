# Studio Bridge data contract (Tutor UI <-> Student UI)

Both apps use the same Supabase project and the same **session code**. Run `schema.sql` once to create the tables.

## Setup (both apps)
The Supabase project already exists and the tables from `schema.sql` are created (live updates on, public `artefacts` storage bucket ready).

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://nqalksankethoskforml.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xYWxrc2Fua2V0aG9za2Zvcm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1MTExMDQsImV4cCI6MjEwOTA4NzEwNH0.qEUGoFSJ0daEi_pXkAzibT9PUhmZ7rmlfO8UrRMBgf8` |

The anon key is public by design (it ships in the browser). Row access is open for the demo, so do not put personal data in it. Never use or commit the `service_role` key.

Student UI (Vite + React): `pnpm add @supabase/supabase-js`, then create the client once:

```ts
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
```

Add both variables in Vercel (Project Settings > Environment Variables) and redeploy. The Tutor UI uses the same values.

## Session code
The tutor starts a class and gets a 4-letter code (for example `K7QF`). Students type it in on the Student UI. Everything below is filtered by `session = <code>`.

## Who writes what

| Table | Student UI | Tutor UI |
|---|---|---|
| `sessions.state` | reads | **writes** `{ slide, activityId, activityKind }` whenever the slide or activity changes |
| `activities` | reads | **writes** one row per activity in the Studio flow (`spec` holds the AI-written questions) |
| `questions` | **inserts** (and +1 upvote) | reads, **updates** `status='ans'` and `answer` |
| `reactions` | **inserts** | reads (counts per kind) |
| `responses` | **inserts** | reads |
| `events` | inserts | inserts |

## Mapping from the Student UI reducer to rows

| Student action | Row |
|---|---|
| `select` + `submit` on a `choice` activity | `responses` `{ kind:'choice', payload:{ answer: 0-3 } }` |
| `select` + `submit` on a `rating` activity | `responses` `{ kind:'rating', payload:{ answer: 1-5 } }` |
| `play` (discussion card) | `responses` `{ kind:'discussion', payload:{ card: 0-4 } }` |
| `photo` + `submit` (artefact) | upload file to bucket `artefacts`, then `responses` `{ kind:'artefact', team, payload:{ url, name, caption } }` |
| peer discussion `post` | `responses` `{ kind:'peer_reply', payload:{ parentId, text } }` |
| asks a question | `questions` row |
| reaction | `reactions` row |

Discussion card order: 0 Agree, 1 Disagree, 2 Take a turn, 3 Clarify, 4 Share an idea.
Reaction kinds: `got`, `think`, `confused`, `insight`, `applause`.

## Activity kinds (shared list)
`concept` (Concept Development, AI questions), `qa`, `discussion`, `artefact`, `reflection` (AI reflection question).
The Student UI's `choice` and `rating` are the multiple-choice and 1-5 question types inside a `concept` activity.

## Logging
Every action in both apps also inserts an `events` row: `{ session, role, type, actor, payload }`.
Event types: `session_started`, `slide_changed`, `activity_started`, `activity_closed`, `question_asked`, `question_upvoted`, `question_answered`, `reaction_sent`, `response_submitted`, `artefact_uploaded`.
Class Learning and the AI insight are computed from `responses` and `events`.

## Realtime
Subscribe to changes on `questions`, `reactions`, `responses` (tutor) and on `sessions`, `activities` (student) filtered by `session`.

## How the tutor app uses your rows (so the fields must match)
- `activity_id` must be the id the tutor wrote in `sessions.state.activityId` (for example `K7QF-a5`). Always send it with a response.
- `payload.q` is the question number inside a concept check (0 to 4). Without it every answer counts toward question 1.
- `questions.text_en`: when a student writes in Chinese, put the Chinese in `text` and the English in `text_en` (the tutor shows English first, with "Original" underneath).
- Reflection answers: `responses` `{ activity_id, kind:'reflection', payload:{ text, lang?, text_en? } }`.
- Reactions: send `got`, `think`, `confused`, `insight` or `applause` in `reactions.kind`.
- Join flow: the student types the 4-letter class code, checks it exists in `sessions`, then subscribes to `sessions` / `activities` for that code.

## Quick test (no code needed)
In Supabase > SQL Editor, using the code shown in the tutor app:
```sql
insert into questions (session, student, text, slide) values ('K7QF', 'Test', 'Hello from the student side', 4);
```
It should appear in the tutor's Questions column within a second.
## Update: free text, peer replies, Q&A replies, upvotes
The Tutor UI now shows these live:
- `responses.kind = 'open'`, `payload { q, text, lang?, text_en? }`: shown under the concept-check question `q` (or under a reflection). Chinese without `text_en` is shown as written.
- `responses.kind = 'peer_reply'`, `payload { parentId?, text, lang?, text_en? }` with the exact tutor `activity_id`: shown under the activity as "Replies between students".
- `responses.kind = 'qa_reply'`, `payload { questionId, text, lang?, text_en? }` (`questionId` = `questions.id`): shown as an answer from a student under that question in the Q&A session. No open `qa` activity is needed.
- Upvotes: call the RPC `upvote_question(qid uuid)` (it adds 1 and returns the new total, so simultaneous votes are not lost): `supabase.rpc('upvote_question', { qid })`.

## Demo class (22 simulated students)
A database job (`supabase/sim-class.sql`, pg_cron every 5 seconds) keeps 22 imaginary students active in any class whose tutor app is open (the tutor app updates `sessions.tutor_seen` every 40 seconds). They ask questions (some in Chinese with `text_en`), upvote, react, answer the running activity (`choice`, `rating`, `open`, `reflection`, discussion cards, artefact links), send `peer_reply` and `qa_reply` rows. Their rows have `payload.sim = true` (questions and reactions use the roster names). **The Student UI does not need to do anything special: it should just show everyone's rows**, so a real tester sees a live class around them:
- questions list: all rows from `questions`, newest first, with upvote counts
- reaction counts: count of `reactions` rows per kind
- discussion card counts: count of `responses` where `kind='discussion'`, grouped by `payload.card`
- concept-check results after a student answers: count `choice` / `rating` rows per `payload.q`
- reflections, peer replies, artefacts: list the other students' rows for the running `activity_id`
To switch the simulator off: `select cron.unschedule('sim_class_tick');`
