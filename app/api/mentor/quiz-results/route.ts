import { retiredEndpoint } from "@/app/lib/academy/server/mentorProxy";

export async function POST() {
  return retiredEndpoint();
}
