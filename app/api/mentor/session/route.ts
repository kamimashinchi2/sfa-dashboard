import { retiredEndpoint } from "@/app/lib/academy/server/mentorProxy";

/** Enrollment-credential login is retired. Accounts use /api/mentor/login. */
export async function POST() {
  return retiredEndpoint();
}
