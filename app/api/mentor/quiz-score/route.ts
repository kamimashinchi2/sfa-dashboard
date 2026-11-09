import { noStoreJson, requireJsonOrigin } from "../../../lib/academy/server/bridgeProxy";
import {
  authorizeStage,
  resolveEntitlement,
} from "../../../lib/academy/server/entitlements";
import { getPrivateQuizBank, stageForQuizId } from "../../../lib/academy/server/privateQuizBanks";
import { scoreQuiz, type QuizAnswer } from "../../../lib/academy/grading";
import { itemHash } from "../../../lib/academy/quizHash";
import { claimReadiness } from "../../../lib/academy/thresholds";


const BODY_CAP = 256_000;

/**
 * Authenticated current-stage scoring. Returns per-item educational
 * feedback + itemHash. Never returns the full answer-key table.
 */
export async function POST(req: Request) {
  const originCheck = requireJsonOrigin(req);
  if (!originCheck.ok) {
    return noStoreJson({ error: originCheck.code }, originCheck.status);
  }

  const ent = await resolveEntitlement();
  if (!ent.ok) {
    return noStoreJson({ error: ent.code }, ent.status);
  }

  const raw = await req.text();
  if (raw.length > BODY_CAP) {
    return noStoreJson({ error: "PAYLOAD_TOO_LARGE" }, 413);
  }
  let body: {
    quizId?: string;
    answers?: Record<string, QuizAnswer>;
    touchedIds?: string[];
    skippedIds?: string[];
  };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return noStoreJson({ error: "BAD_JSON" }, 400);
  }

  const quizId = body.quizId?.trim();
  if (!quizId) return noStoreJson({ error: "QUIZ_ID_REQUIRED" }, 400);
  const stage = stageForQuizId(quizId);
  if (stage == null) return noStoreJson({ error: "UNKNOWN_QUIZ" }, 404);
  if (!authorizeStage(stage, ent.entitlement.unlockedStage)) {
    return noStoreJson({ error: "STAGE_LOCKED" }, 403);
  }

  const bank = getPrivateQuizBank(quizId);
  if (!bank) return noStoreJson({ error: "NO_BANK" }, 404);

  const scored = scoreQuiz(bank, body.answers ?? {}, {
    touchedIds: body.touchedIds,
    skippedIds: body.skippedIds,
  });

  const perItem = await Promise.all(
    scored.perItem.map(async (p) => {
      const item = bank.find((i) => i.id === p.id)!;
      return {
        id: p.id,
        pass: p.pass,
        unanswered: p.unanswered,
        skipped: p.skipped,
        remediationTopic: p.remediationTopic,
        kind: p.kind,
        itemHash: await itemHash(item),
        // Educational feedback for this item only — not the answer key
        rationale: item.rationale,
      };
    }),
  );

  return noStoreJson({
    score: scored.score,
    correct: scored.correct,
    total: scored.total,
    weakTopics: scored.weakTopics,
    allAnswered: scored.allAnswered,
    readiness: claimReadiness(scored.score),
    unverifiedClaim: true,
    perItem,
  });
}
