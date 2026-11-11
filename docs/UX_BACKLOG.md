# UX backlog

These are the hard, confusing, or unfinished parts left after the student-journey fixes. They are ranked by how much they block an average student. The last section is teaching, not software.

## Ranked product gaps

1. **Password help still depends on a human being awake.** The login page now says to use the support chat, and no email is pretended. If the chat widget is blocked, or the owner is offline, the student is stuck with no ticket number and no status. Fix: a "I forgot my password" form that stores a request on the server, shows "the owner has been told", and lists it in `sfa status`, still without emailing a secret.

2. **Nobody wakes Echo.** A finished quiz can sit on "waiting for Echo" with no clock and no promise. The dashboard says grading time is not guaranteed, which is honest and still unpleasant. Fix: show the age of the pending review, and send the owner one alarm when a queue item is older than 24 hours.

3. **Two different "submit" ideas.** The dashboard upload is the real practical. `/submit` still builds a local markdown packet for practice. A careful student will do both and not know which one Echo reads. Fix: rename the local page to "Practice notes (not graded)" and remove any wording that sounds like the official hand-in.

4. **The header still looks like a trading terminal.** It shows local XP, "earned 0", a build stamp on desktop, and a 1% risk chip. None of that is the week's task. The real next step is on the dashboard, which a student may not open. Fix: replace the three chips with the same "what to do next" sentence, and hide XP unless the student opens practice details.

5. **A quiz has no server-side draft.** Refresh now restores answers in this browser tab's session. A second device, a cleared browser, or a crashed phone still loses the attempt. The quiz is long. Fix: save untouched drafts to the account every minute, and restore them on any device until submit.

6. **The 8-week calendar is invisible until Echo grades the quiz.** Students do not see "you are in week 3 of 8, assignment due Friday" on day one of a lesson. Fix: show the cohort clock from the invite, even while the lesson is still unread.

7. **Override is easy to miss.** The owner has 24 hours and the student is not shown "this grade can still be corrected until Tuesday 18:00". Fix: show the deadline on the verdict card, in both Amsterdam and local time.

8. **Support chat is a third-party script.** tawk.to may fail on slow networks or be blocked. The button then only reveals a "refresh" note. Fix: a first-party help box on the login page that does not load an outside domain.

9. **RTL is better and not finished.** Login and dashboard titles follow the language, and Persian text uses a font that has Arabic letters. Lesson prose, quiz choices, and tickers such as EURUSD still mix directions. A Persian sentence with an English ticker can jump. Fix: wrap every ticker, number, and filename in isolated left-to-right runs inside the lesson renderer, and read every mission once in Persian on a phone.

10. **Error pages while the API is down used to spin forever.** They now stop after eight seconds and say the content stays locked. The message is still "fail closed", which is accurate for an engineer and cold for a student. Fix: one sentence, "The academy is briefly unavailable. Your place in the course is saved. Try again in a few minutes." with the support chat link.

## Teaching gaps that make finishing hard

The software can gate eight weeks. It cannot yet teach an average beginner through them.

- There is no worked example before the quiz. A student is asked to judge a structural stop, spread, or macro link without seeing one annotated case in the same screen. Add one fully narrated example per stage, marked as not-for-credit, before the assessed questions.
- The quizzes are long and the pass line is 60% for partial, 80% for a clean pass. A beginner who misunderstands one idea can miss a cluster of questions and fall into retake with only "wrong" beside each item until Echo writes the explanation. Until Echo is fast, that wait is the lesson. Put a one-line restudy pointer on each wrong item from the lesson text, without revealing the key.
- Risk is taught as a calculator and then judged as a hard gate (1% and 1:2, structural stop only). The calculator can show HARD_BLOCK, but the weekly assignment does not walk the student through a single filled example with equity, stop distance, and rounded-down size. Add that walkthrough to the assignment card the moment it is issued.
- Spiral review is real from stage 2, and it is easy to treat as extra homework with no time budget. Say how long it should take, or cut it to one earlier skill per week instead of every earlier stage every week. The current rule is stricter than an average student's week.
- Week 8 ends in a meeting the site cannot book. Students can feel they "failed to finish" because the dashboard says waiting. Tell them, in the week 8 lesson itself, what to bring to that meeting and that the wait is the last assignment.
- There is no "I am stuck on this sentence" path inside a lesson, only the global chat. A confused student on a phone will not know which paragraph to quote. Add a per-lesson "ask about this section" that pastes the section title into the chat draft.

None of these are excuses to unlock lessons from the browser. They are why a diligent student can still stall even after the buttons are clear.
