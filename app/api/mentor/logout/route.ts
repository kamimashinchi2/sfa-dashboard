import { noStoreJson, requireJsonOrigin } from "@/app/lib/academy/server/bridgeProxy";
import { clearSessionCookie } from "@/app/lib/academy/server/sessionCookie";


export async function POST(req: Request) {
  const originCheck = requireJsonOrigin(req);
  if (!originCheck.ok) {
    return noStoreJson({ error: originCheck.code }, originCheck.status);
  }
  await clearSessionCookie();
  return noStoreJson({ ok: true });
}
