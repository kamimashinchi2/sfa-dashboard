import { noStoreJson, requireJsonOrigin } from "../../../lib/academy/server/bridgeProxy";
import { clearSessionCookie } from "../../../lib/academy/server/sessionCookie";


export async function POST(req: Request) {
  const originCheck = requireJsonOrigin(req);
  if (!originCheck.ok) {
    return noStoreJson({ error: originCheck.code }, originCheck.status);
  }
  await clearSessionCookie();
  return noStoreJson({ ok: true });
}
