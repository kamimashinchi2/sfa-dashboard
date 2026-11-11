import { proxyMentor } from "@/app/lib/academy/server/mentorProxy";

type Ctx = { params: Promise<{ slug: string[] }> };

export async function GET(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  return proxyMentor(req, "GET", slug);
}

export async function POST(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  return proxyMentor(req, "POST", slug);
}
