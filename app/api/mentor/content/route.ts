import { noStoreJson } from "../../../lib/academy/server/bridgeProxy";
import {
  authorizeStage,
  resolveEntitlement,
} from "../../../lib/academy/server/entitlements";
import {
  getPrivateAdvanced,
  getPrivateMission,
  getPrivateQuizBank,
  stageForQuizId,
} from "../../../lib/academy/server/privateQuizBanks";
import {
  hydrateQuizAnswers,
  toPublicQuizItem,
} from "../../../lib/academy/server/hydrateQuiz";
import { itemHash } from "../../../lib/academy/quizHash";
import { stageNumberForId } from "../../../lib/academy/publicCatalog";


/**
 * Authenticated content delivery for a mission/advanced module.
 * Future stages fail closed. No answer keys in response.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const missionId = url.searchParams.get("missionId");
  const moduleId = url.searchParams.get("moduleId");
  const id = missionId || moduleId;
  if (!id || (missionId && moduleId)) {
    return noStoreJson({ error: "EXACT_ID_REQUIRED" }, 400);
  }

  const stage = stageNumberForId(id) ?? stageForQuizId(id);
  if (stage == null) {
    return noStoreJson({ error: "UNKNOWN_ID" }, 404);
  }

  const ent = await resolveEntitlement();
  if (!ent.ok) {
    return noStoreJson(
      {
        error: ent.code,
        locked: true,
        reason:
          ent.code === "UNAUTHORIZED"
            ? { fa: "برای ادامه وارد شوید.", en: "Please sign in to continue." }
            : {
                fa: "وضعیت دسترسی در دسترس نیست — محتوا قفل است.",
                en: "Entitlement unavailable — content locked (fail closed).",
              },
      },
      ent.status,
    );
  }

  if (!authorizeStage(stage, ent.entitlement.unlockedStage)) {
    return noStoreJson(
      {
        error: "STAGE_LOCKED",
        locked: true,
        requestedStage: stage,
        unlockedStage: ent.entitlement.unlockedStage,
        reason: {
          fa: `درس مرحله ${stage} قفل است. پس از تأیید تمرین عملی مرحلهٔ فعلی باز می‌شود — تأیید آزمون به‌تنهایی کافی نیست.`,
          en: `Stage ${stage} is locked. Practical approval/partial (after admin delivery) unlocks the next lesson — quiz approval never does.`,
        },
      },
      403,
    );
  }

  const bank = getPrivateQuizBank(id);
  if (!bank) {
    return noStoreJson({ error: "NO_BANK" }, 404);
  }

  const hydrated = hydrateQuizAnswers(bank);
  const publicQuiz = await Promise.all(
    hydrated.map(async (item) =>
      toPublicQuizItem(item, await itemHash(item)),
    ),
  );

  if (missionId) {
    const mission = getPrivateMission(missionId);
    if (!mission) return noStoreJson({ error: "NOT_FOUND" }, 404);
    return noStoreJson({
      kind: "mission",
      id: mission.id,
      stages: mission.stages,
      title: mission.title,
      summary: mission.summary,
      practicalTask: mission.practicalTask,
      lessons: mission.lessons,
      quiz: publicQuiz.map(({ itemHash: h, ...rest }) => {
        // Omit rationale until score/check — keep remediationTopic for UX labels only
        void h;
        return {
          ...rest,
          itemHash: h,
          // rationale intentionally omitted from initial payload
        };
      }),
      entitlement: ent.entitlement,
    });
  }

  const mod = getPrivateAdvanced(moduleId!);
  if (!mod) return noStoreJson({ error: "NOT_FOUND" }, 404);
  return noStoreJson({
    kind: "advanced",
    id: mod.id,
    stages: mod.stages,
    title: mod.title,
    summary: mod.summary,
    practicalTask: mod.practicalTask,
    lessons: mod.lessons,
    quiz: publicQuiz.map((q) => ({
      id: q.id,
      kind: q.kind,
      prompt: q.prompt,
      options: q.options,
      remediationTopic: q.remediationTopic,
      itemHash: q.itemHash,
    })),
    entitlement: ent.entitlement,
  });
}
