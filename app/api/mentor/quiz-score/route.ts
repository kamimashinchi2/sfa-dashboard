import { retiredEndpoint } from "@/app/lib/academy/server/mentorProxy";

/** Per-question scoring moved to POST /api/mentor/quizzes. No answer oracle. */
export async function POST() {
  return retiredEndpoint();
}
