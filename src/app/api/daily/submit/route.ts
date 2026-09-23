import { dailyState, GameError, submitDaily } from "@/server/daily";
import { handle, siteUrl } from "@/server/http";
import { currentUser } from "@/server/user";

export async function POST(request: Request) {
  return handle(async () => {
    const user = await currentUser();
    if (!user) throw new GameError("No slate started today", 409);
    await submitDaily(user);
    return Response.json(await dailyState(user, siteUrl(request)));
  });
}
