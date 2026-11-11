import { logoutAccount } from "@/app/lib/academy/server/mentorProxy";

export async function POST(req: Request) {
  return logoutAccount(req);
}
