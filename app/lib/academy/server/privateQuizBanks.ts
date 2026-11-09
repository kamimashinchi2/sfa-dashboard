import "server-only";
/**
 * Full quiz banks WITH answers — server-only.
 * Never import from client components. Operator extract_answer_key.mjs
 * reads answerKeyData; this module is the runtime authority for scoring.
 */
import type { QuizItem } from "../curriculum";
import { getMission, missions } from "../curriculum";
import { getAdvanced, advancedModules } from "../advancedCurriculum";
import { bridgeStageForId } from "../publicCatalog";
import { hydrateQuizAnswers } from "./hydrateQuiz";

export function getPrivateQuizBank(quizId: string): QuizItem[] | null {
  const m = getMission(quizId);
  if (m) return hydrateQuizAnswers(m.quiz);
  const a = getAdvanced(quizId);
  if (a) return hydrateQuizAnswers(a.quiz);
  return null;
}

export function listPrivateQuizBanks(): { quizId: string; items: QuizItem[] }[] {
  const out: { quizId: string; items: QuizItem[] }[] = [];
  for (const m of missions)
    out.push({ quizId: m.id, items: hydrateQuizAnswers(m.quiz) });
  for (const a of advancedModules)
    out.push({ quizId: a.id, items: hydrateQuizAnswers(a.quiz) });
  return out;
}

export function getPrivateMission(missionId: string) {
  return getMission(missionId);
}

export function getPrivateAdvanced(moduleId: string) {
  return getAdvanced(moduleId);
}

/** Bridge stage 1..8 for a quiz/mission id (contracts.py). */
export function stageForQuizId(quizId: string): number | null {
  return bridgeStageForId(quizId);
}
