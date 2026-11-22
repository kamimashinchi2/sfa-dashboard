# Content pack v3

The pack lives in this directory. `node scripts/build-content-v3.mjs` validates it and writes client-safe modules plus a server-only answer key. The script runs before `npm test`, `npm run typecheck`, and `npm run build`. It never prints answer values.

Copy a replacement pack over `content/v3` (keep this shape) and run the generator again. Stub files are marked `STUB` and are meant to be replaced. A full pack has 6–12 chapters per level. L03 has 12. The loader accepts 1–12 so a short stub still builds.

## Text

Every `Text` is `{ "fa": string, "en": string }`. Markdown is allowed. A chapter has an `enReviewed` boolean.

## manifest.json

```json
{
  "packVersion": "3",
  "source": "where the chapters came from",
  "levels": [
    { "level": "L00", "stage": 0, "public": true, "graded": false, "chapters": ["codes in order"] },
    { "level": "L01", "stage": 1, "missionId": "M1", "graded": true, "chapters": [] },
    { "level": "L06", "stage": 6, "advancedId": "A6", "graded": true, "chapters": [] }
  ]
}
```

L00 is the readiness level, stage 0, public (no login), ungraded, and leads into L01. L01–L05 are M1–M5. L06–L08 are A6–A8. Chapter codes are listed in teaching order.

## chapters/\<CODE\>.json

Codes look like `MCFX-L01-C03`.

```json
{
  "code": "MCFX-L01-C03",
  "level": "L01",
  "order": 3,
  "title": { "fa": "", "en": "" },
  "objectives": [{ "fa": "", "en": "" }],
  "body": { "fa": "", "en": "" },
  "workedExample": { "fa": "", "en": "" },
  "riskExample": { "fa": "", "en": "" },
  "trap": { "fa": "", "en": "" },
  "reality": { "fa": "", "en": "" },
  "exercises": [{ "prompt": { "fa": "", "en": "" }, "selfCheck": { "fa": "", "en": "" } }],
  "summary": { "fa": "", "en": "" },
  "question": { "fa": "", "en": "" },
  "selfReviewRubric": [{ "fa": "", "en": "" }],
  "sourceRefs": [],
  "gaps": [],
  "enReviewed": false
}
```

`body` is required. `objectives`, `workedExample`, `riskExample`, `trap`, `reality`, `exercises`, and `summary` may be omitted. `selfCheck` is `Text` or `null`. Exercises are ungraded. The site shows `selfCheck` behind a "show answer" toggle. `question` is the Socratic reflection.

## quizzes/\<LEVEL\>.quiz.json

Public. No answers. L00 has none. Every graded level has 10 items.

```json
{
  "level": "L01",
  "items": [
    {
      "id": "L01-Q01",
      "kind": "mc",
      "prompt": { "fa": "", "en": "" },
      "options": [{ "fa": "", "en": "" }, { "fa": "", "en": "" }, { "fa": "", "en": "" }, { "fa": "", "en": "" }],
      "rationale": { "fa": "", "en": "" },
      "remediationTopic": "topic",
      "chapterRef": "MCFX-L01-C03"
    }
  ]
}
```

`kind` is `mc`, `numeric`, or `order`. Multiple choice has 4 options. Order items are the list to arrange. Numeric items have no options. `rationale` must not name the correct option. The generator fails if a public quiz contains `answer`, `answers`, `correct`, `correctAnswer`, `correctIndex`, `key`, or `solution`.

## keys/\<LEVEL\>.key.json

Server-only. L00 has none. Ids must match the public quiz. The generator does not print these values.

```json
{
  "level": "L01",
  "answers": { "L01-Q01": 0 },
  "provenance": { "L01-Q01": "chapter or source note" }
}
```

An `mc` answer is an integer index. A `numeric` answer is a decimal string. An `order` answer is an array of integer indexes. A level whose multiple-choice answers all share one index produces a warning, not a failure.

## homework/\<LEVEL\>.json

L00 has none.

```json
{
  "level": "L01",
  "dailyTask": { "fa": "", "en": "" },
  "groundingChapters": ["MCFX-L01-C03"],
  "checklist": [{ "fa": "", "en": "" }],
  "fridayPlanRequired": false,
  "riskDrill": { "fa": "", "en": "" },
  "gaps": []
}
```

`riskDrill` is `Text` or `null`. `fridayPlanRequired` is true only for A8 (L08), matching `sfa_api/plan_policy.py`. Any other level that sets it fails validation.

## rules.json

Risk rules are per level, with situation notes. Effective rules for a week are `defaults` overridden by that level's fields. The grader enforces only the numeric bounds (`maxRiskPctPerTrade`, `minRiskPctPerTrade` when set, `stopRequirement`, `mentalStopIsHardBlock`, `minNetRR`). `situations` are not auto-scored. They are copied into the Echo grading packet so the mentor can judge whether the student used the risk the chapters teach for that market condition. Students do not receive this packet field. Lesson prose can still state the plain rule.

```json
{
  "defaults": {
    "maxRiskPctPerTrade": "1.00",
    "stopRequirement": "HARD_STRUCTURAL",
    "mentalStopIsHardBlock": true,
    "minNetRR": "2.00",
    "stopBlockMode": "MENTAL_OR_NONE",
    "unplannedStopMoveIsHardBlock": false
  },
  "levels": {
    "L01": {
      "maxRiskPctPerTrade": "0.50",
      "minRiskPctPerTrade": "0.25",
      "stopRequirement": "HARD_STRUCTURAL",
      "mentalStopIsHardBlock": true,
      "minNetRR": "2.00",
      "situations": [
        {
          "id": "wide-news",
          "condition": { "fa": "", "en": "" },
          "riskPct": "0.50",
          "stopRule": { "fa": "", "en": "" },
          "rrRule": { "fa": "", "en": "" },
          "citation": "MCFX-L05-C04"
        }
      ]
    }
  }
}
```

Every override field is optional. An empty object means "use defaults". Decimal fields are strings with two places (`x.xx`). `stopRequirement` `HARD_STRUCTURAL` means a missing hard stop is a `HARD_BLOCK`. `mentalStopIsHardBlock: true` means a mental stop is a `HARD_BLOCK` when `stopBlockMode` is `MENTAL_OR_NONE`.

Approved names, as shipped in `rules.json`: `stopRequirement` is `REGISTERED_STOP` (the legacy alias is `HARD_STRUCTURAL`). `stopBlockMode` is `NO_STOP_ONLY` (only a missing stop is a `HARD_BLOCK`) or `MENTAL_OR_NONE` (legacy: a mental stop or a missing stop is a `HARD_BLOCK`). `mentalStopIsHardBlock` is false. `unplannedStopMoveIsHardBlock` is true. `plannedStopMoveAllowed` is true, so a pre-written move such as break-even at 1.5R is not a block. `dailyLossCapPct` is null, which means no daily-loss cap. L05 sets `maxRiskPctPerTrade` to `2.00` and carries `dailyActiveRiskCap` and `weeklyCompliancePause`. Those two fields are not scored. They travel with `situations` in the Echo packet. The `approval` block stays in the file and is not sent to students.

`shared/legacy-rules.json` is the previous gate (1%, mental stop blocks, unplanned move does not). Scoring-vector tests use that fixture. The live grader uses this file.

The shipped file has the defaults above and empty objects for L00–L08. That reproduces today's behaviour: 1% maximum risk, a hard structural stop, a mental stop as `HARD_BLOCK`, and net reward:risk of at least 1:2. Quiz bands stay 80/60 and practical bands stay 80/65 with pillars 40/40/20 in the existing policy, not in this file. A later source-derived cap is a change to `rules.json` only. Restart the API after the file is installed (`install.sh` copies it to `/etc/sfa/rules.json`).

## What the generator writes

- `app/lib/academy/generated/v3Manifest.ts` — level order and chapter codes
- `app/lib/academy/generated/v3Chapters.ts` — chapter bodies
- `app/lib/academy/generated/v3PublicL00.ts` — L00 only, for the public route
- `app/lib/academy/generated/v3Quizzes.ts` — public quizzes, no answers
- `app/lib/academy/generated/v3Homework.ts`
- `app/lib/academy/generated/v3RiskRules.ts` — numeric bounds only, no situations
- `app/lib/academy/server/v3AnswerKeyData.ts` — `import "server-only"`

Legacy `answerKeyData.ts` ids stay as they are. The v3 key is merged at hydrate time and by `extract_answer_key.mjs` under quiz ids `L01`–`L08`. Assessed week banks remain `M1`–`A8`.
