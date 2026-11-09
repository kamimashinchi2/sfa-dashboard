/**
 * Client-and-test-safe hydrator. Imports answerKeyData — do NOT import this
 * module from client UI components (bundle leak). OK for vitest + server.
 */
import type { QuizItem } from "./curriculum";
import { QUIZ_ANSWER_KEY } from "./server/answerKeyData";

export function withAnswers(items: QuizItem[]): QuizItem[] {
  return items.map((item) => {
    const answer = item.answer ?? QUIZ_ANSWER_KEY[item.id];
    return answer === undefined ? { ...item } : { ...item, answer };
  });
}

export function withAnswer(item: QuizItem): QuizItem {
  const answer = item.answer ?? QUIZ_ANSWER_KEY[item.id];
  return answer === undefined ? { ...item } : { ...item, answer };
}
