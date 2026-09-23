import { dailyState, GameError, resetDaily } from "@/server/daily";
import { handle, siteUrl } from "@/server/http";
import { testToolsEnabled } from "@/server/testing";
import { currentUser } from "@/server/user";

export async function POST(request: Request) {
  return handle(async () => {
    if (!testToolsEnabled) throw new GameError("Not found", 404);
    const user = await currentUser();
    if (user) await resetDaily(user);
    return Response.json(await dailyState(user, siteUrl(request)));
  });
}
