import { noStoreJson, proxyToBridge } from "@/app/lib/academy/server/bridgeProxy";
import { resolveEntitlement } from "@/app/lib/academy/server/entitlements";
import {
  getPrivateAdvanced,
  getPrivateMission,
  getPrivateQuizBank,
  stageForQuizId,
} from "@/app/lib/academy/server/privateQuizBanks";
import {
  hydrateQuizAnswers,
  toPublicQuizItem,
} from "@/app/lib/academy/server/hydrateQuiz";
import { bilingual } from "@/app/lib/academy/server/publicErrors";
import { readSessionToken } from "@/app/lib/academy/server/sessionCookie";
import { itemHash } from "@/app/lib/academy/quizHash";
import { stageNumberForId } from "@/app/lib/academy/publicCatalog";

/**
 * Authenticated lesson delivery.
 * Python authorize/<stage> runs before any lesson or quiz body is read into the response.
 * Future stages are not returned. Answer keys and rationale stay on the server.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const missionId = url.searchParams.get("missionId");
  const moduleId = url.searchParams.get("moduleId");
  const id = missionId || moduleId;
  if (!id || (missionId && moduleId)) {
    return noStoreJson({ error: "EXACT_ID_REQUIRED", ...bilingual("VALIDATION_FAILED") }, 400);
  }

  const stage = stageNumberForId(id) ?? stageForQuizId(id);
  if (stage == null) {
    return noStoreJson({ error: "UNKNOWN_ID" }, 404);
  }

  const token = await readSessionToken();
  if (!token) {
    return noStoreJson(
      {
        error: "UNAUTHORIZED",
        locked: true,
        ...bilingual("UNAUTHORIZED"),
        reason: {
          fa: "برای ادامه وارد شوید.",
          en: "Please sign in to continue.",
        },
      },
      401,
    );
  }

  const authorized = await proxyToBridge({
    method: "GET",
    flaskPath: `/api/v1/authorize/${stage}`,
    bearerToken: token,
  });
  if (!authorized.ok) {
    return noStoreJson(
      {
        error: authorized.code,
        locked: true,
        reason: {
          fa: "وضعیت دسترسی در دسترس نیست — محتوا قفل است.",
          en: "Entitlement unavailable — content locked (fail closed).",
        },
      },
      authorized.status,
    );
  }
  const authBody = authorized.result.body;
  const allowed =
    authorized.result.status === 200 &&
    !!authBody &&
    typeof authBody === "object" &&
    (authBody as { allowed?: unknown }).allowed === true &&
    (authBody as { stage?: unknown }).stage === stage;
  if (!allowed) {
    const ent = await resolveEntitlement();
    const unlocked =
      ent.ok ? ent.entitlement.unlockedStage : undefined;
    return noStoreJson(
      {
        error: "STAGE_LOCKED",
        locked: true,
        requestedStage: stage,
        ...(unlocked != null ? { unlockedStage: unlocked } : {}),
        ...bilingual("STAGE_LOCKED"),
        reason: {
          fa: `درس مرحله ${stage} قفل است. تأیید آزمون درس بعدی را باز نمی‌کند؛ فقط تمرین عملی مثبت مرحله را جلو می‌برد.`,
          en: `Stage ${stage} is locked. Quiz approval never unlocks the next lesson; a positive practical does.`,
        },
      },
      authorized.result.status === 401 ? 401 : 403,
    );
  }

  const ent = await resolveEntitlement();
  if (!ent.ok) {
    return noStoreJson(
      {
        error: ent.code,
        locked: true,
        reason: {
          fa: "وضعیت دسترسی در دسترس نیست — محتوا قفل است.",
          en: "Entitlement unavailable — content locked (fail closed).",
        },
      },
      ent.status,
    );
  }

  const bank = getPrivateQuizBank(id);
  if (!bank) return noStoreJson({ error: "NO_BANK" }, 404);
  const hydrated = hydrateQuizAnswers(bank);
  const publicQuiz = await Promise.all(
    hydrated.map(async (item) => toPublicQuizItem(item, await itemHash(item))),
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
      quiz: publicQuiz,
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
    quiz: publicQuiz,
    entitlement: ent.entitlement,
  });
}
