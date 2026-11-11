# Local verification — 11 November 2026 (Europe/Amsterdam)

- Python: 115 passed, 6 skipped (`pytest -q -rs tests`, Python3.13).
- Six real PostgreSQL integration cases clearly SKIPPED: pg_ctl/initdb server binaries not available. PostgreSQL17 client tools alone were present.
- Attempted system PostgreSQL/libmagic/shellcheck installation: apt repository metadata fetches failed with HTTP500/signature errors on this box. No server installed. A user-space pgserver test dependency also had no matching distribution in the available package index. Neither failure is evidence that Oracle's normal Ubuntu apt repositories fail.
- Portable state-machine tests use an explicitly test-only SQLite transport harness, NOT a production storage fallback and NOT a PostgreSQL integration claim.
- Local HTTP Echo client dry-run passed: queue/report/claim/quiz decision idempotent submit/original download digest/practical decision. No production account or live server was contacted by those tests.
- HMAC raw multipart streaming, upload limits/magic, Argon2 login/reset, strict runtime contracts, thresholds, exact decimal hard-block math, 2 distinct clean-week weakness resolution, stage8 terminal state, claims/conflicts, 24h override/relock, cross-user guards, optional notifications bot and ambiguous-send behavior covered.
- bash -n install.sh backup.sh: PASS.
- ShellCheck0.11.0 (installed user-space via shellcheck-py): PASS (no findings; SC2016 is deliberately scoped for child-shell $1).
- Python compileall: PASS.
- Extractor ran against Next repo main4c39c0614364295cc8b3baa7c4c123782ad69fdc using Node24.22.1: 8 banks / 80 hydrated canonical private answer records. No answer key is included in this archive.
- Generated contract from actual Flask route registry, without a DB connection.
- Public DNS-over-HTTPS returned A92.5.230.55 for92-5-230-55.sslip.io. Public Suffix List had no sslip.io entry. Local box resolver is synthetic (198.18.0.1), so no inference about Oracle DNS was made from it.

NOT tested: real PostgreSQL runtime/migration/concurrency, actual Ubuntu22.04/24.04 or ARM installer, PM2-user discovery against owner's process tree, Oracle firewall/VCN behavior, actual Caddy install/certificate issuance, real Telegram API/delivery, backup/restore on a real DB, final frontend implementation/typecheck/build/browser integration. No TLS issuance, deployment, git push/PR, real student sends, account registrations or Drive changes were performed.

Before real students: run the PostgreSQL suite on a disposable local/server test DB as an unprivileged user; complete Cursor frontend tests; run full pilot signup->quiz->assignment->upload->grading->unlock->override; verify listeners/HTTPS; test backup restore; configure Echo secure key injection and routine. Treat this as a reviewable pilot package, not production-certified deployment.
