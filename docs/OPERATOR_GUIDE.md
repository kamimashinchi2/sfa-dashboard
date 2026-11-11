# Operator guide

This is the owner's guide to the academy site. You do not need to be a developer. The site is a private school for one cohort at a time. Students do the work in the browser. Echo grades the queue. You handle invites, exceptions, and the final conversation.

Do not paste passwords, the Echo key, or reset links into chat, email, or screenshots.

## How the site works

1. You send one cohort invite link. A student opens it, chooses a display name, email, and a password of at least 12 characters, and accepts the short data notice. No confirmation email is sent. The email is only the login name.
2. Week 1, lesson M1, opens. The student reads it and submits the whole quiz. The server scores the quiz from a private answer key. The student sees right or wrong, not the answer key.
3. Echo reads the queue and writes bilingual feedback. Thresholds are fixed: a quiz is approved at 80, partially approved from 60 to 79, and not approved below 60. Partial or full approval creates a personal assignment. It does not open the next lesson. A failed quiz means restudy and retake.
4. The student does the assignment and uploads files in the dashboard, then presses final submit. Limits are 12 files, 20 MB each. Allowed types are PDF, DOCX, TXT, MD, PNG, and JPG. A phone HEIC photo is rejected. Screenshots alone are rejected. A document is required. Telegram cannot accept the assignment.
5. Echo scores the practical 40 points risk, 40 points technical and macro, 20 points journal. Approved is 80 or more. Partial is 65 to 79. Below 65 is not approved. Any of these also fails the practical, whatever the points: a mental stop instead of a hard structural stop, risk above 1% of equity, or net reward below 1:2.
6. A positive practical opens the next lesson. A negative practical starts a remedial week at the same stage. Stage 8 does not open a stage 9. It marks the student as waiting for you, the senior mentor.
7. You have 24 hours after a grade is delivered to retract it with a written reason. The old grade stays in the audit log. If the student already started the next piece of work, the site refuses the automatic rollback and tells you to handle it by hand.

Echo is not a live chat. The header says queue review. There is no promised grading time until your Echo routine is actually polling.

## When a new student arrives

1. On the server, create a fresh invite if the old one is expired, used up, or you do not trust who has it:

   ```bash
   sudo sfa invite --days 30 --max-uses 100
   ```

   Send that link in private. The installer also leaves the first invite in `/etc/sfa/cohort-invite`.
2. Tell the student what they will see: a join page, then the dashboard. The first line on the dashboard is "What to do next". Persian and English are both on the site. The language button is in the header.
3. Telegram is optional. If you did not configure a bot token, the dashboard simply does not offer it. Students can finish with the website alone.
4. Grading happens when Echo polls `/echo/v1/queue`, claims one item, reads the report and files, and submits a decision. You are notified only if an admin Telegram chat is configured. Otherwise watch the dashboard, or run `sudo sfa status`.
5. Your own account: sign up with the invite, then:

   ```bash
   sudo sfa make-admin you@example.com
   ```

   The email must already be registered.

## Password reset, with no email

The site cannot email a reset. If a student forgets the password, they open the support chat on the login page and tell you the name and email they used. You check that it is really them, then:

```bash
sudo sfa reset-password student@example.com
```

The command prints one link, valid for 30 minutes, single use. Send it in private. When they set a new password, every existing login on every device is signed out.

## The other owner commands

```bash
sudo sfa status
sudo sfa override DECISION_ID --reason 'What was wrong with this grade'
sudo sfa backup-now
sudo sfa show-echo-key
sudo sfa check-echo-key
sudo sfa rotate-echo-key
```

`status` shows that the database answers and how many students and pending reviews there are.

`override` works only within 24 hours of delivery, and only if the student has not already done later work. Say what was wrong. The student is told. Echo gets a new queue item.

`check-echo-key` prints `ok` or `mismatch`. It does not print the key. If it says mismatch, run the installer configure step again or `sudo sfa rotate-echo-key`, then restart is included in rotate.

`show-echo-key` prints the secret. Use a private terminal only.

## Backup and restore

```bash
sudo sfa backup-now
```

The archive lands in `/var/backups/sfa/`. It contains the database, uploads, and `/etc/sfa`, including secrets. It is root-only. Nightly backups run at 03:15 Europe/Amsterdam and are kept 14 days. A backup on the same disk does not survive a dead disk. Copy the archive somewhere else, encrypted, when you can.

Restore on a spare machine first, not on top of the live site:

1. Stop `sfa-api` and `sfa-bot`.
2. Unpack the archive in private.
3. Restore the database with `pg_restore` as the postgres user into the `sfa` database.
4. Restore `/var/lib/sfa/uploads` and `/etc/sfa`. The Echo key file must be root and mode 0600. The app env file is owned by the `sfa` user.
5. Start the services and check one known student, one grade, and one file.
6. If you think a secret leaked, rotate the Echo key and the database password before students return.

## If the site is down

1. `sudo sfa status` and `systemctl status sfa-api sfa-bot`. The API log is `journalctl -u sfa-api -n 80`.
2. `curl -sS http://127.0.0.1:8081/echo/v1/health` should say version 6. That address is local only.
3. `sudo sfa check-echo-key` should print `ok`.
4. If the public site fails but health is ok, the proxy is the problem. Rerun the installer with the same domain and `--proxy nginx` or `--proxy caddy`, matching what the server already uses. Do not switch proxies casually.
5. If login says the academy service is unreachable, the API process is down. `sudo systemctl restart sfa-api`.

## Weekly routine

Once a week, same day:

- `sudo sfa status`. If pending reviews are piling up, Echo is not polling.
- `sudo sfa check-echo-key`.
- `sudo sfa backup-now`, then confirm a new file exists in `/var/backups/sfa/`.
- Read any override you still owe. The window is 24 hours, not "when you get to it".
- Skim the support chat. Reset passwords only after you know who is asking.
- Invite link: if the cohort is full or the link leaked, issue a new `sfa invite`. Old unused links still work until they expire or run out of uses.

## Week 8 wrap-up

A positive stage 8 practical does not graduate the student. The dashboard says they are waiting for the senior mentor. There is no stage 9.

In the session, use the report on their dashboard. It is the history of quizzes, practicals, and weaknesses. You decide what "finished" means in conversation. The site will not print a diploma.

## After you pull new code

From the repository root, on the server, rerun:

```bash
sudo bash backend/sfa-academy-v6/install.sh --domain YOUR_DOMAIN --proxy nginx --rebuild-next
```

Use `--proxy caddy` instead if this host is already on Caddy. The rerun keeps the database password, the Echo key, and student work. It rebuilds the website and restarts the API so the new pages and the key hash are loaded. You do not run a separate migration command for this release. The API applies the schema when it starts.
