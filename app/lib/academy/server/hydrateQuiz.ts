import "server-only";
import type { QuizItem } from "../curriculum";
import { QUIZ_ANSWER_KEY } from "./answerKeyData";

/** Attach private answers for server-side scoring / hashing. */
export function hydrateQuizAnswers(items: QuizItem[]): QuizItem[] {
  return items.map((item) => {
    const answer = QUIZ_ANSWER_KEY[item.id];
    if (answer === undefined) return { ...item };
    return { ...item, answer };
  });
}

/** Public quiz payload: prompts/options/topics + itemHash; no answer key. */
export type PublicQuizItem = {
  id: string;
  kind: QuizItem["kind"];
  prompt: QuizItem["prompt"];
  options?: QuizItem["options"];
  remediationTopic: string;
  itemHash: string;
};

export function toPublicQuizItem(
  item: QuizItem,
  itemHash: string,
): PublicQuizItem {
  return {
    id: item.id,
    kind: item.kind,
    prompt: item.prompt,
    options: item.options,
    remediationTopic: item.remediationTopic,
    itemHash,
  };
}
