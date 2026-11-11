# SFA v6 API contract

Generated from `sfa_api/app.py` route registrations by `python tools/generate_contract.py`.
All JSON UTF-8; no-store. Variable path segments are URL-encoded. GETs have empty body.
`/api/v1/*` is LOOPBACK-ONLY HMAC proxy, never browser-direct. Every listed student
route requires HMAC **and** `Authorization: Bearer <opaque student session>` unless marked HMAC only.
All `/echo/v1/*` except health require Echo Bearer; no student or HMAC credential grants Echo access.
`/api/mentor/<suffix>` in Next maps to `/api/v1/<suffix>`; keep content's existing query contract
but authorize it through Python before loading the server-only lesson. Do not proxy `/echo` via public Next routes.

## Signing and browser sessions

HMAC SHA256 input: UTF8(timestamp + "\n" + nonce + "\n" + METHOD + "\n" + Python path + "\n")
concatenated with EXACT raw body bytes. Header X-SFA-Signature=sha256=<hex>, X-SFA-Timestamp=Unix seconds,
X-SFA-Nonce=random URL-safe >=16 chars. Window 300s, nonce single-use across all workers.
No query parameters on Python endpoints. Authorization is forwarded server-side only.
Login/signup Python responses contain sessionToken; Next must set `__Host-sfa_session`, HttpOnly, Secure,
SameSite=Strict, Path=/, Max-Age=604800, **no Domain**, and remove the token before returning JSON to browser.
Strict is intentional because sslip.io is NOT a public suffix; subdomains may be same-site, so enforce
EXACT Origin separately on EVERY mutation (including auth/admin/multipart). Never trust SameSite alone.
Telegram link GETs work without cookies; returning to dashboard may require a same-site navigation/reload.
Logout deletes cookie with matching attributes and invalidates server session.
Trusted client-IP for login/signup throttling is set by Next as X-SFA-Client-IP from the proxy,
never copied blindly from browser headers. Account limit 10/10min; observed IP limit 40/10min.
Echo limit 120/min; all limits DB-backed across processes.

For multipart: ONE file per HTTP request; Next spools <=22MiB to a private temporary file while
hashing the original complete multipart bytes (including original boundary), then signs/streams
those exact bytes to Flask with original Content-Type, Content-Length, Authorization and duplex:'half'.
Never reconstruct FormData after signing, buffer all 12 files, or expose HMAC secret to browser.
Flask separately spools/hashes before parsing; temp files closed in finally. Allow 180s upload timeout,
8s JSON timeout. Per-file 20MiB, per-submission 12. HTTP 413 on coarse oversize; 400 validation codes.

## Routes

|Method|Python path|Auth|Request|Success JSON|
|---|---|---|---|---|
|GET|`/api/v1/admin/decisions`|ADMIN session + HMAC|`none`|`{decisions:[{id,student,state,body:Decision,delivered_at}]}`|
|GET|`/api/v1/admin/students`|ADMIN session + HMAC|`none`|`{students:[{student,display_name,email,stage,current_week,role}]}`|
|GET|`/api/v1/assignment`|student|`none`|`{week,stage,status,assignment:Assignment or null}`|
|GET|`/api/v1/authorize/<int:stage>`|student|`none`|`{allowed:true,stage}`|
|GET|`/api/v1/data-notice`|HMAC only|`none`|`{version:1,text:string}`|
|GET|`/api/v1/entitlements`|student|`none`|`{unlockedStage,currentWeek,status}`|
|GET|`/api/v1/me`|student|`none`|`Me`|
|GET|`/api/v1/notifications`|student|`none`|`{notifications:[{id,body:object,created,isRead}]}`|
|GET|`/api/v1/practicals`|student|`none`|`{submissions:[{id,stage,week,state,created,files:[File]}]}`|
|GET|`/api/v1/quizzes`|student|`none`|`{attempts:[{attemptId,quizId,stage,week,created,assessmentStatus}]}`|
|GET|`/api/v1/quizzes/<attempt>`|student|`none`|`{attemptId,assessment:PublicAssessment,decision:Decision or null}`|
|GET|`/api/v1/report`|student|`none`|`Report`|
|GET|`/api/v1/responses/<int:stage>`|student|`none`|`{responses:object or null}`|
|GET|`/echo/v1/files/<fid>`|Echo Bearer|`none`|`original attachment; verify digest/size from queue`|
|GET|`/echo/v1/health`|public|`none`|`{ok:true, version:6}`|
|GET|`/echo/v1/queue`|Echo Bearer|`none`|`{requests:[QueueItem],policy:{quizApproved:80,quizPartial:60,practicalApproved:80,practicalPartial:65,cleanWeeks:2,approvalRequired}}`|
|GET|`/echo/v1/students/<sid>/report`|Echo Bearer|`none`|`Report`|
|POST|`/api/v1/admin/decisions/<did>/approve`|ADMIN session + HMAC|`{}`|`{ok:true}`|
|POST|`/api/v1/admin/decisions/<did>/override`|ADMIN session + HMAC|`{reason}`|`{ok:true}`|
|POST|`/api/v1/legacy-import`|student|`{records:object; <=500000 UTF-8 JSON chars}`|`{imported:true,verified:false,unlocksChanged:false}`|
|POST|`/api/v1/login`|HMAC only|`{email,password}`|`{sessionToken,expiresIn:604800,me:Me}`|
|POST|`/api/v1/logout`|student|`{}`|`{ok:true}`|
|POST|`/api/v1/notifications/<nid>/read`|student|`{}`|`{ok:true}`|
|POST|`/api/v1/practicals/<sid>/files`|student|`multipart/form-data: exactly one field file`|`File`|
|POST|`/api/v1/practicals/<sid>/submit`|student|`{}`|`{submissionId,status:"QUEUED"}`|
|POST|`/api/v1/practicals/draft`|student|`{}`|`{submissionId,files:[File]}`|
|POST|`/api/v1/quizzes`|student|`QuizInput`|`{attemptId,assessment:PublicAssessment,decision:Decision or null}`|
|POST|`/api/v1/reset-password`|HMAC only|`{token,password}`|`{ok:true}`|
|POST|`/api/v1/responses/<int:stage>`|student|`{responses:object}`|`{ok:true}`|
|POST|`/api/v1/signup`|HMAC only|`{inviteToken,displayName,email,password,acceptDataNotice:true}`|`{sessionToken,expiresIn:604800,me:Me}`|
|POST|`/api/v1/telegram/connect-link`|student|`{}`|`{url,expiresIn:900}`|
|POST|`/echo/v1/claims/<path:rid>`|Echo Bearer|`{}`|`{requestId,leaseToken,expiresAt:unixSeconds}`|
|POST|`/echo/v1/decisions`|Echo Bearer|`{requestId,leaseToken,decision:Decision,riskEvidence?:RiskEvidence}`|`{decisionId,state:"DELIVERED" or "PENDING_APPROVAL",idempotent:boolean}`|

## Shared exact types

- Me = {studentId:string,displayName:string,email:string|null,role:"STUDENT"|"ADMIN",
  unlockedStage:1..8,currentWeek:number,status:string,telegramEnabled:boolean,telegramLinked:boolean}.
- QuizInput = {attemptId:string (new UUID per intentional retake; same ID for network retry),
  quizId:"M1".."M5"|"A6".."A8",buildCommit:7..40 lowercase hex,
  items:[{itemId,itemHash:64 lowercase hex,kind:"mc"|"numeric"|"order",
  studentAnswer:number|string|number[]|null,touched:boolean,reflection:string|null}]}.
  FULL canonical bank required, not shuffled display indexes. No scores/correctAnswer/identity claims accepted.
  Canonical indexes restored via quizShuffle utilities before submission.
- PublicAssessment = {status:"RECOMPUTED"|"UNVERIFIED",reason?:string,score?:number|null,
  correct?:number,total?:number,verdict?:string|null,items:[{itemId,correct:boolean}]}.
  Never contains expected answer table. Corrections appear only in delivered Decision.
- Assignment = {week,stage,title:{fa,en},coreTasks:[{fa,en}],weaknessDrills:[{weaknessId,task:{fa,en}}],
  spiralReview:[{stage,skill,task:{fa,en}}],riskRules:{maxRiskPct:"1",hardStructuralStop:true,minNetRR:"2",noSignals:true},
  deliverables:[{fa,en}],dueAtISO:timezone-aware ISO about 7 days in future}. All prior stages covered;
  every open/improving/new weakness drilled. Assignment JSON schema included.
- Decision = exact v2 `quiz-decision.schema.json` or `practical-decision.schema.json`. Runtime contracts.py
  is stricter than schema: thresholds, wrong-item FA/EN explanations, weakness evidence, state and spiral coverage.
- RiskEvidence (REQUIRED on practical envelope) = {currentEquity:string,riskAmount:string,netReward:string,
  stopType:"STRUCTURAL_HARD"|"MENTAL"|"NONE",evidenceRefs:[string]}. Decimal monetary totals are in the SAME
  account currency; include fees/slippage/round-down sizing from separate risk review. Server computes
  riskAmount/currentEquity <=0.01 and netReward/riskAmount >=2, and requires structural hard stop.
  finalHardBlock MUST match computed result. Missing/NaN/zero-risk evidence leaves request pending via 400,
  never an invented approval. Server cannot verify a narrative/chart claim; Echo reviewers must read originals.
- File = {fileId,name,size,digest:sha256,mime}. Download URLs are Echo-only, not publicly shared.
- QueueItem quiz = {requestId:"quiz:<attemptId>",studentId,week,claimExpires:number|null,
  kind:"quiz_assessment",packet:full canonical quiz v2 (server-injected identity),assessment:private deterministic
  result including per-item studentAnswer,correctAnswer,itemHash,topic,correct,clientMismatch}.
  Missing key/hash drift => UNVERIFIED; do NOT deliver a decision.
- QueueItem practical = {requestId:"practical:<submissionId>",studentId,week,stage,claimExpires,
  kind:"practical_submission",files:[File]}.
- Report = {student:{student,alias,stage,current_week},markdown:string,weaknesses:[{student,id,skill,first_week,
  evidence:JSON-string,status:"OPEN"|"IMPROVING"|"RESOLVED",last_drilled,clean_weeks,last_clean_week}],
  weeks:[{student,week,stage,state,attempt,assignment:JSON-string|null,quiz_verdict,practical_verdict}],
  decisions:[{id,state,body:Decision,override_reason:string|null}]}.

Timestamps named created/expiresAt/claimExpires are Unix seconds (convert to Europe/Amsterdam for display).
Report dates include that zone. Escape Markdown/HTML in student/admin UI; never execute uploaded content.
Decision verdicts are APPROVED/PARTIALLY_APPROVED/NOT_APPROVED. Quiz approval NEVER unlocks;
positive practical below stage8 does, stage8 => AWAITING_SENIOR_MENTOR (no stage9).

Claims last 30min. Submit envelope must carry leaseToken returned by claim and exactly its requestId.
Never print Echo key, session tokens or lease tokens in routine chat summaries. Same decisionId + target +
canonical body is idempotent even after lease expiry. Different body/ID for same target is rejected.
Only PENDING items appear; prior pending-approval/delivered/unknown/retracted targets aren't regraded.
Overrides create a NEW request ID; do not reuse old claims.

All errors: {error:string,message?:string}. 401 auth/session, 403 stage lock, 429 throttled,
400 semantic validation or stale/claim/conflict, 413 coarse body limit, 500 sanitized internal error.
Next adds bilingual error copy based on code, never raw exceptions. It must not convert every non-2xx to 503.
No email sending, Drive, Telegram submissions, manual link codes, or client-derived unlock API exists.
