-- Demo class simulator: while a tutor app is open, 22 imaginary students keep asking questions, reacting and answering,
-- so both the Tutor UI and the Student UI feel like a live class. It runs inside the database (pg_cron), so it works
-- whichever app is open, and it needs no changes in either app.
-- Rows written by the simulator use the 22 roster names below. Remove everything with: select cron.unschedule('sim_class_tick');

create extension if not exists pg_cron with schema pg_catalog;

-- the tutor app touches this every 40 seconds; the simulator only runs for classes with a tutor present
alter table sessions add column if not exists tutor_seen timestamptz;

create or replace function public.sim_roster() returns text[] language sql immutable as $$
  select array['Alex Morgan','Maya Chen','Leo Park','Yuki Tanaka','Amira Khan','Ben Tran','Chloe Rossi','Dev Patel','Elena Sosa','Farid Ali','Hamza Noor',
    'Sara Ali','Ravi Shah','Emma Lowe','Jun Wei','Mei Lin','Ayaan Gupta','Lucas Silva','Nora Haddad','Tom Fischer','Zoe Kim','Priya Menon']::text[]
$$;

create or replace function public.sim_tick() returns void language plpgsql security definer set search_path = public as $$
declare
  roster text[] := public.sim_roster();
  zh text[] := array['Jun Wei','Mei Lin'];
  qpool jsonb := '[
    {"t":"How do we decide which research patterns belong in the same persona?"},
    {"t":"Can one persona represent two different user groups?"},
    {"t":"How many interviews are enough before we write the persona?"},
    {"t":"Should the persona include a name and a photo?"},
    {"t":"我们应该先做亲和图还是先写用户画像？","e":"Should we do the affinity diagram first or write the persona first?"},
    {"t":"What is the difference between an insight and an observation?"},
    {"t":"Can we change our How Might We question after the client meeting?"},
    {"t":"How detailed should the problem reframe be?"},
    {"t":"我们的访谈证据够吗？","e":"Is our interview evidence enough?"},
    {"t":"Do we hand in the persona canvas this week?"},
    {"t":"How do I show the evidence behind each persona goal?"},
    {"t":"Is it okay to use a quote from someone who did not give consent?"}]'::jsonb;
  open_pool jsonb := '[
    {"t":"In my project, I used interview notes to find the main user need."},
    {"t":"We grouped the quotes on the wall and saw that most users skip long readings."},
    {"t":"I tried it with one user from my team and changed our brief."},
    {"t":"I would test the idea with two more users before deciding."},
    {"t":"我们用访谈证据重写了问题。","e":"We rewrote the problem using interview evidence."},
    {"t":"It helps us stop guessing what users want."},
    {"t":"我在项目中用这个方法找到了真正的需求。","e":"In my project I used this method to find the real need."},
    {"t":"Our persona now has a goal and a frustration from real quotes."}]'::jsonb;
  refl_pool jsonb := '[
    {"t":"A new idea for me is that a persona comes from patterns in research, not guesses."},
    {"t":"I am still not sure how to choose the most important insight."},
    {"t":"This changed how I will write my How Might We question."},
    {"t":"我以前以为用户画像只是想象，现在我知道要用证据。","e":"I used to think a persona was imagined. Now I know to use evidence."},
    {"t":"Next I will go back to my interview notes and look for patterns."},
    {"t":"I want to see an example of a good reframed brief."},
    {"t":"My team was working from assumptions, and now we can check them."},
    {"t":"我想先用亲和图整理我们的发现。","e":"I want to organise our findings with an affinity diagram first."}]'::jsonb;
  reply_pool jsonb := '[
    {"t":"Good example. Can you add one more quote?"},
    {"t":"We did the same thing in our team."},
    {"t":"I am not sure about that. Where did the evidence come from?"},
    {"t":"That is a clear way to say it, thank you."},
    {"t":"Maybe we can test that with a real user."},
    {"t":"I agree. It also helped us."}]'::jsonb;
  art_pool jsonb := '[
    {"u":"persona-1.svg","n":"Persona card"},{"u":"persona-2.svg","n":"Persona card"},{"u":"persona-3.svg","n":"Persona card"},
    {"u":"persona-example.svg","n":"Persona example"},{"u":"persona-template.svg","n":"Persona template"}]'::jsonb;
  site text := 'https://studio-bridge-theta.vercel.app/assets/artefacts/';
  ses record; stu text; aid text; akind text; aspec jsonb; nq int; qi int; qtype text; item jsonb; n int; rx float; k text; qid uuid; opts int; okidx int; ans int; txt text;
begin
  for ses in select code, state from sessions where tutor_seen > now() - interval '3 minutes' loop
    -- first visit: the class is already in the room
    if not exists (select 1 from questions where session = ses.code and student = any(roster)) then
      for n in 1..6 loop
        item := qpool -> floor(random() * jsonb_array_length(qpool))::int;
        insert into questions (session, student, anonymous, text, text_en, lang, slide, upvotes, created_at)
          select ses.code, roster[1 + floor(random() * 22)::int], false, item->>'t', item->>'e', case when item ? 'e' then 'zh' end, 6 + floor(random() * 6)::int, 1 + floor(random() * 9)::int, now() - random() * interval '14 minutes'
          where not exists (select 1 from questions where session = ses.code and text = item->>'t');
      end loop;
      insert into reactions (session, kind, student)
        select ses.code, (array['got','got','got','applause','think','insight','confused'])[1 + floor(random() * 7)::int], roster[1 + floor(random() * 22)::int] from generate_series(1, 28);
    end if;

    -- reactions
    if random() < 0.7 then
      insert into reactions (session, kind, student)
        values (ses.code, (array['got','got','got','applause','applause','think','insight','confused'])[1 + floor(random() * 8)::int], roster[1 + floor(random() * 22)::int]);
    end if;
    -- a new question now and then
    if random() < 0.06 and (select count(*) from questions where session = ses.code and student = any(roster)) < 14 then
      item := qpool -> floor(random() * jsonb_array_length(qpool))::int;
      insert into questions (session, student, anonymous, text, text_en, lang, slide, upvotes)
        select ses.code, roster[1 + floor(random() * 22)::int], false, item->>'t', item->>'e', case when item ? 'e' then 'zh' end, 6 + floor(random() * 6)::int, 1
        where not exists (select 1 from questions where session = ses.code and text = item->>'t');
      insert into events (session, role, type, payload) values (ses.code, 'student', 'question_asked', '{"sim":true}');
    end if;
    -- upvotes
    if random() < 0.3 then
      update questions set upvotes = upvotes + 1 where id = (select id from questions where session = ses.code and status = 'open' order by random() limit 1);
    end if;
    -- a student replies to a question in the Q&A
    if random() < 0.12 then
      select id into qid from questions where session = ses.code and (select count(*) from responses r where r.session = ses.code and r.kind = 'qa_reply' and r.payload->>'questionId' = questions.id::text) < 4 order by random() limit 1;
      if qid is not null then
        item := reply_pool -> floor(random() * jsonb_array_length(reply_pool))::int;
        insert into responses (session, activity_id, kind, student, payload)
          values (ses.code, coalesce(ses.state->>'activityId', 'none'), 'qa_reply', roster[1 + floor(random() * 22)::int], jsonb_build_object('questionId', qid, 'text', item->>'t', 'sim', true));
      end if;
    end if;

    -- whatever activity the tutor is running
    aid := ses.state->>'activityId'; akind := ses.state->>'activityKind';
    if aid is null then continue; end if;

    if akind = 'concept' then
      select a.spec into aspec from activities a where a.id = aid;
      nq := jsonb_array_length(coalesce(aspec->'questions', '[]'::jsonb));
      if nq > 0 and random() < 0.85 then
        qi := floor(random() * nq)::int; item := aspec->'questions'->qi; qtype := item->>'type';
        select x into stu from unnest(roster) x where not exists (select 1 from responses r where r.activity_id = aid and r.student = x and r.kind in ('choice','rating','open') and (r.payload->>'q')::int = qi) order by random() limit 1;
        if stu is not null then
          if qtype = 'mc' then
            opts := jsonb_array_length(coalesce(item->'options', '[]'::jsonb)); okidx := 0;
            for n in 0..opts - 1 loop if (item->'options'->n->>'ok')::boolean then okidx := n; end if; end loop;
            ans := case when random() < 0.6 then okidx else floor(random() * greatest(opts, 1))::int end;
            insert into responses (session, activity_id, kind, student, payload) values (ses.code, aid, 'choice', stu, jsonb_build_object('q', qi, 'answer', ans, 'sim', true));
          elsif qtype = 'scale' then
            insert into responses (session, activity_id, kind, student, payload) values (ses.code, aid, 'rating', stu, jsonb_build_object('q', qi, 'answer', (array[2,3,3,4,4,4,5,5])[1 + floor(random() * 8)::int], 'sim', true));
          else
            item := open_pool -> floor(random() * jsonb_array_length(open_pool))::int;
            if item ? 'e' and not (stu = any(zh)) then item := open_pool -> 0; end if;
            insert into responses (session, activity_id, kind, student, payload)
              values (ses.code, aid, 'open', stu, jsonb_build_object('q', qi, 'text', item->>'t', 'lang', case when item ? 'e' then 'zh' else 'en' end, 'text_en', item->>'e', 'sim', true));
          end if;
          insert into events (session, role, type, actor, payload) values (ses.code, 'student', 'response_submitted', stu, '{"sim":true}');
        end if;
      end if;
      if random() < 0.12 then
        item := reply_pool -> floor(random() * jsonb_array_length(reply_pool))::int;
        insert into responses (session, activity_id, kind, student, payload) values (ses.code, aid, 'peer_reply', roster[1 + floor(random() * 22)::int], jsonb_build_object('text', item->>'t', 'sim', true));
      end if;

    elsif akind = 'discussion' then
      if random() < 0.7 then
        rx := random();
        insert into responses (session, activity_id, kind, student, payload)
          values (ses.code, aid, 'discussion', roster[1 + floor(random() * 22)::int], jsonb_build_object('card', case when rx < .35 then 0 when rx < .5 then 1 when rx < .65 then 2 when rx < .8 then 3 else 4 end, 'sim', true));
      end if;

    elsif akind = 'reflection' then
      if random() < 0.35 then
        select x into stu from unnest(roster) x where not exists (select 1 from responses r where r.activity_id = aid and r.student = x and r.kind = 'reflection') order by random() limit 1;
        if stu is not null then
          item := refl_pool -> floor(random() * jsonb_array_length(refl_pool))::int;
          if item ? 'e' and not (stu = any(zh)) then item := refl_pool -> 0; end if;
          insert into responses (session, activity_id, kind, student, payload)
            values (ses.code, aid, 'reflection', stu, jsonb_build_object('text', item->>'t', 'lang', case when item ? 'e' then 'zh' else 'en' end, 'text_en', item->>'e', 'sim', true));
        end if;
      end if;
      if random() < 0.12 then
        item := reply_pool -> floor(random() * jsonb_array_length(reply_pool))::int;
        insert into responses (session, activity_id, kind, student, payload) values (ses.code, aid, 'peer_reply', roster[1 + floor(random() * 22)::int], jsonb_build_object('text', item->>'t', 'sim', true));
      end if;

    elsif akind = 'artefact' then
      if random() < 0.2 and (select count(*) from responses where activity_id = aid and kind = 'artefact') < 8 then
        select x into stu from unnest(roster) x where not exists (select 1 from responses r where r.activity_id = aid and r.student = x and r.kind = 'artefact') order by random() limit 1;
        if stu is not null then
          item := art_pool -> floor(random() * jsonb_array_length(art_pool))::int;
          insert into responses (session, activity_id, kind, student, team, payload)
            values (ses.code, aid, 'artefact', stu, case when random() < 0.4 then 'Group ' || (1 + floor(random() * 6)::int) end, jsonb_build_object('url', site || (item->>'u'), 'name', item->>'n', 'caption', 'Our draft', 'sim', true));
        end if;
      end if;
    end if;
  end loop;
end $$;

-- every 5 seconds
select cron.unschedule('sim_class_tick') where exists (select 1 from cron.job where jobname = 'sim_class_tick');
select cron.schedule('sim_class_tick', '5 seconds', 'select public.sim_tick()');
