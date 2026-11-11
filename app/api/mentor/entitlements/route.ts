import { proxyMentor } from "@/app/lib/academy/server/mentorProxy";

/** GET → /api/v1/entitlements. Fail closed. unlockedStage is clamped to 1..8. */
export async function GET(req: Request) {
  return proxyMentor(req, "GET", ["entitlements"]);
}