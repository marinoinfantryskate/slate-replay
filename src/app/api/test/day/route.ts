import { dailyState, GameError } from "@/server/daily";
import { handle, siteUrl } from "@/server/http";
import { dayOffset, setDayOffset, testToolsEnabled } from "@/server/testing";
import { currentUser } from "@/server/user";

/** Body: { "move": "next" | "today" } */
export async function POST(request: Request) {
  return handle(async () => {
    if (!testToolsEnabled) throw new GameError("Not found", 404);
    const body = await request.json().catch(() => null);
    await setDayOffset(body?.move === "next" ? (await dayOffset()) + 1 : 0);
    return Response.json(await dailyState(await currentUser(), siteUrl(request)));
  });
}
