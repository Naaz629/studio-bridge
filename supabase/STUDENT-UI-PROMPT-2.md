You are updating my Student UI (https://github.com/dlua0926/Studio-Bridge, React 19 + Vite + TypeScript, Supabase already connected). The connection works: the tutor and student apps already exchange questions, reactions, answers and the tutor's slide and activity. Now I need the demo to feel like a REAL CLASS of 20 to 25 students, so a tester who joins as one student sees and feels everyone else around them.

## What is new on the backend (already running, nothing for you to build)
- 22 simulated students are active in any class whose Tutor UI is open. Every few seconds they insert real rows into Supabase: new `questions` (some in Chinese with an English `text_en`), more `upvotes`, `reactions`, and answers to the running activity in `responses` (`choice`, `rating`, `open`, `reflection`, `discussion`, `artefact`, `peer_reply`, `qa_reply`). Their rows have `payload.sim = true`. Contract and field names: https://github.com/Naaz629/studio-bridge/blob/main/supabase/DATA-CONTRACT.md (see "Demo class").
- There is no class code to type any more. This is a demo, so everyone joins ONE shared class with the code `DEMO`. Remove the class-code field from the join dialog: ask only for the student's name (or anonymous) and join `DEMO` automatically when the app opens. Keep the code in one constant so it can change later. The Tutor UI also uses `DEMO` automatically.

## What the Student UI must show (it must use everyone's rows, not only my own)
1. **Questions panel**: all rows from `questions` for the class, with live upvote counts and the "Translated from Chinese / View original" note when `text_en` exists. New rows from other students should slide in without a refresh. Keep the tutor's answer (`status='ans'`, `answer`) visible.
2. **Reaction row**: counts must be the number of `reactions` rows per kind for the class (so the numbers keep rising while other students react). Show a small pop animation when a count goes up.
3. **Discussion cards activity**: students only play their own card. Do NOT show how many times other students played each card. The Tutor UI shows that live count.
4. **Concept check**: after I submit an answer, show the class result for that question (bars for multiple choice, an average for the 1 to 5 scale) from the `choice` / `rating` rows for the same `activity_id` and `payload.q`, updating live. For open questions, show a few of the other students' answers (`kind='open'`, English first, with "View original" when `text_en` exists). Show the `peer_reply` rows under the activity as "Replies between students".
5. **Reflection**: after I submit, show a few other students' reflections (`kind='reflection'`).
6. **Artefact activity**: show a gallery of the other students' uploads (`kind='artefact'`, `payload.url`, `team`, `payload.caption`), newest first, updating live.
7. **Q&A replies**: under each question show `qa_reply` rows (`payload.questionId`, `payload.text`) as replies from classmates, and let me reply (insert a `qa_reply`).
8. **"Live class" feel**: in the header show how many students are active, for example "22 in class" (count distinct `student` values seen in the last 5 minutes across `questions`, `reactions` and `responses`, plus me). Add a quiet "live" dot.
9. **Names**: show first name and last initial for other students, never anything else. My own name stays as I typed it.

## Layout bug to fix
In the concept check and artefact screens the bottom area overlaps: the line "Your response is shared with your tutor." and the thinking field sit under the "Submit response" button. Give the activity card enough bottom padding and make the submit button part of the normal flow so nothing overlaps at 1024 x 768 and 1440 x 900 (these apps run on laptops and a classroom board only).

## Rules
- Do not add authentication and do not use the service_role key.
- Use Supabase Realtime (`postgres_changes`) filtered by the class code, with the initial load plus the existing 15-second refresh as a safety net. Do not poll faster.
- Keep the offline demo mode working as it does today.
- Do not insert fake rows from the Student UI. The backend already creates the other students.
- Show me the full code of every file you change, with paths, and tell me how to test: open the Student UI while the Tutor UI is open in another tab, then watch the questions, reactions, card counts and results move on their own while I interact.
