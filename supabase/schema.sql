-- Studio Bridge: shared backend for the Tutor UI and the Student UI.
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Both apps join the same class by a short session code (for example "K7QF").

create extension if not exists pgcrypto;

-- one row per live class; the tutor keeps "state" up to date and students read it
create table if not exists sessions (
  code        text primary key,
  unit        text,                       -- e.g. IDEA9106
  week        int,
  state       jsonb not null default '{}'::jsonb,   -- { slide, activityId, activityKind, updatedAt }
  created_at  timestamptz not null default now()
);

-- activities the tutor puts in the Studio flow (the AI-written questions live in spec)
create table if not exists activities (
  id          text primary key,           -- e.g. "<code>-a3"
  session     text not null references sessions(code) on delete cascade,
  kind        text not null check (kind in ('concept','qa','discussion','artefact','reflection')),
  slide       int,                        -- slide number it follows
  spec        jsonb not null default '{}'::jsonb,   -- questions, options, hint ...
  created_at  timestamptz not null default now()
);

-- the Questions column
create table if not exists questions (
  id          uuid primary key default gen_random_uuid(),
  session     text not null references sessions(code) on delete cascade,
  student     text,                       -- display name, null when anonymous
  anonymous   boolean not null default false,
  text        text not null,              -- as the student wrote it
  text_en     text,                       -- English version when the original was Chinese
  lang        text,
  slide       int,
  upvotes     int not null default 1,
  status      text not null default 'open' check (status in ('open','ans')),
  answer      text,
  created_at  timestamptz not null default now()
);

-- reactions: got it, thinking, confused, insightful, applause
create table if not exists reactions (
  id          bigint generated always as identity primary key,
  session     text not null references sessions(code) on delete cascade,
  kind        text not null check (kind in ('got','think','confused','insight','applause')),
  student     text,
  created_at  timestamptz not null default now()
);

-- everything a student answers: choice, rating, cards, reflection, artefact (url in payload)
create table if not exists responses (
  id          uuid primary key default gen_random_uuid(),
  session     text not null references sessions(code) on delete cascade,
  activity_id text not null,
  kind        text not null,
  student     text,
  team        text,
  payload     jsonb not null default '{}'::jsonb,   -- { answer: 2 } | { card: 3 } | { text: "..", lang: ".." } | { url, caption }
  created_at  timestamptz not null default now()
);

-- append-only log of every action in both apps (this is the "logging data")
create table if not exists events (
  id          bigint generated always as identity primary key,
  session     text not null references sessions(code) on delete cascade,
  role        text not null check (role in ('tutor','student')),
  type        text not null,              -- e.g. slide_changed, activity_started, question_asked, question_answered, response_submitted
  actor       text,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists questions_session_idx  on questions(session, created_at);
create index if not exists responses_session_idx  on responses(session, activity_id);
create index if not exists events_session_idx     on events(session, created_at);

-- Row Level Security. For the class demo both apps use the public anon key, so anyone with a session code can read and
-- write that class. Tighten this later (tutor PIN or sign-in) before using it with real student data.
alter table sessions   enable row level security;
alter table activities enable row level security;
alter table questions  enable row level security;
alter table reactions  enable row level security;
alter table responses  enable row level security;
alter table events     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['sessions','activities','questions','reactions','responses','events'] loop
    execute format('drop policy if exists "demo read"   on %I', t);
    execute format('drop policy if exists "demo insert" on %I', t);
    execute format('drop policy if exists "demo update" on %I', t);
    execute format('create policy "demo read"   on %I for select using (true)', t);
    execute format('create policy "demo insert" on %I for insert with check (true)', t);
  end loop;
  -- only these are edited after they are created
  create policy "demo update" on sessions  for update using (true) with check (true);
  create policy "demo update" on questions for update using (true) with check (true);
  create policy "demo update" on activities for update using (true) with check (true);
end $$;

-- live updates for both apps
alter publication supabase_realtime add table sessions, activities, questions, reactions, responses, events;

-- artefact photos: create a PUBLIC storage bucket called "artefacts" in Supabase > Storage
-- (or run:)  insert into storage.buckets (id, name, public) values ('artefacts','artefacts',true) on conflict do nothing;

-- students upvote through this function so two votes at the same time are not lost
create or replace function public.upvote_question(qid uuid) returns integer language sql security invoker set search_path = public as $$ update public.questions set upvotes = upvotes + 1 where id = qid returning upvotes; $$;
grant execute on function public.upvote_question(uuid) to anon, authenticated;
